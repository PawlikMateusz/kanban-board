// Shared CalDAV helpers used by the route handlers in caldav.pb.js.
// Note: hook handlers run in isolated programs, so they must `require()` this
// module inside the handler (see caldav.pb.js).
//
// Configuration comes from the RADICALE_URL, RADICALE_USER and
// RADICALE_PASSWORD environment variables. The feature is disabled when any of
// them is missing. RADICALE_TZID (default "Europe/Warsaw") selects the timezone
// used for DTSTART/DUE in the synced VTODO.

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function env(name) {
  const v = $os.getenv(name)
  return v !== undefined && v !== null && v !== "" ? v : ""
}

function caldavEnabled() {
  return env("RADICALE_URL") !== "" && env("RADICALE_USER") !== "" && env("RADICALE_PASSWORD") !== ""
}

// IANA timezone used for DTSTART/DUE. Defaults to Europe/Warsaw (the server's
// timezone); override with RADICALE_TZID.
function caldavTzid() {
  return env("RADICALE_TZID") || "Europe/Warsaw"
}

function caldavResource(taskId) {
  return env("RADICALE_URL").replace(/\/+$/, "") + "/kanban-" + taskId + ".ics"
}

function authHeader() {
  return "Basic " + b64encode(env("RADICALE_USER") + ":" + env("RADICALE_PASSWORD"))
}

// ---------------------------------------------------------------------------
// iCalendar helpers
// ---------------------------------------------------------------------------

// RFC 5545 text escaping (backslash, newline, comma, semicolon).
function icalEscape(text) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

// "2026-08-01T18:00:00.000Z" -> "20260801T180000Z"
function toIcalDate(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return toIcalDate(new Date())
  const s = d.toISOString()
  return s.slice(0, 19).replace(/[-:]/g, "") + "Z"
}

// The app stores due dates as a wall-clock value ("2026-08-04 09:00:00.000Z" or
// "2026-08-04T09:00:00.000Z"). We treat those components as local time in the
// configured timezone (the user's phone is on the same clock), exactly like the
// iOS Reminders entries. -> "20260804T090000"
function wallIcal(value) {
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!m) return ""
  return m[1] + m[2] + m[3] + "T" + m[4] + m[5] + "00"
}

// IANA transition rules used to build the VTIMEZONE block. Only Europe/Warsaw
// (the deployment's timezone) is bundled; the iOS example uses the same rules.
// Unknown TZIDs fall back to emitting plain UTC times.
const TZ_RULES = {
  "Europe/Warsaw": [
    { type: "STANDARD", name: "CET", start: "19961027T030000", rule: "FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", from: "+0200", to: "+0100" },
    { type: "DAYLIGHT", name: "CEST", start: "19880327T020000", rule: "FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", from: "+0100", to: "+0200" },
  ],
}

function buildVtimezone(tzid) {
  const rules = TZ_RULES[tzid]
  if (!rules) return ""
  const parts = ["BEGIN:VTIMEZONE", "TZID:" + tzid]
  for (const r of rules) {
    parts.push("BEGIN:" + r.type)
    parts.push("DTSTART:" + r.start)
    parts.push("RRULE:" + r.rule)
    parts.push("TZNAME:" + r.name)
    parts.push("TZOFFSETFROM:" + r.from)
    parts.push("TZOFFSETTO:" + r.to)
    parts.push("END:" + r.type)
  }
  parts.push("END:VTIMEZONE")
  return parts.join("\r\n")
}

// Folds lines longer than 75 octets (byte-aware so UTF-8 is never split).
function foldIcal(body) {
  const out = []
  for (const line of body.split("\r\n")) {
    if (!line) {
      out.push("")
      continue
    }
    const chunks = []
    let buf = ""
    let bytes = 0
    for (let i = 0; i < line.length; i++) {
      const code = line.charCodeAt(i)
      let sz
      let c = line[i]
      if (code < 0x80) sz = 1
      else if (code < 0x800) sz = 2
      else if (code >= 0xd800 && code <= 0xdbff) {
        sz = 4
        c = line.slice(i, i + 2)
        i++
      } else sz = 3
      if (bytes + sz > 75 && buf) {
        chunks.push(buf)
        buf = ""
        bytes = 0
      }
      buf += c
      bytes += sz
    }
    if (buf) chunks.push(buf)
    // continuation lines start with a single space
    out.push(chunks.join("\r\n "))
  }
  return out.join("\r\n")
}

// Emits a VTODO that mirrors what the iOS Reminders app writes: DTSTART and DUE
// in the local timezone (with a VTIMEZONE block), no VALARM. The due date is
// the only date/time we sync.
function buildVtodo(task) {
  const tzid = caldavTzid()
  const wall = wallIcal(task.getString("dueDate") || "")
  const title = icalEscape(task.get("title"))
  const desc = icalEscape(task.get("description") ?? "")
  const stamp = toIcalDate(new Date())
  const created = toIcalDate(task.getString("created"))

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//kanban-board//CalDAV Sync//EN",
    "CALSCALE:GREGORIAN",
  ]
  const vtz = buildVtimezone(tzid)
  if (vtz) lines.push(vtz)

  // DTSTART/DUE are the stored wall-clock components. With a known TZID they
  // carry the local time; otherwise they fall back to UTC.
  const useTz = !!TZ_RULES[tzid]
  const dtstart = useTz ? "DTSTART;TZID=" + tzid + ":" + wall : "DTSTART:" + wall + "Z"
  const due = useTz ? "DUE;TZID=" + tzid + ":" + wall : "DUE:" + wall + "Z"

  lines.push(
    "BEGIN:VTODO",
    "CREATED:" + created,
    "DTSTAMP:" + stamp,
    dtstart,
    due,
    "LAST-MODIFIED:" + stamp,
    "STATUS:NEEDS-ACTION",
    "SUMMARY:" + title,
  )
  if (desc) lines.push("DESCRIPTION:" + desc)
  lines.push("UID:kanban-" + task.id + "@kanban-board")
  lines.push("END:VTODO", "END:VCALENDAR")
  return foldIcal(lines.join("\r\n") + "\r\n")
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

// Minimal base64 encoder (Basic auth header).
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

function b64encode(str) {
  const bytes = []
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = str.charCodeAt(i + 1)
      const cp = ((code - 0xd800) << 10) + (next - 0xdc00) + 0x10000
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      )
      i++
    } else bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
  }
  let out = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    out += B64_CHARS[b0 >> 2]
    out += B64_CHARS[((b0 & 0x3) << 4) | (b1 >> 4)]
    out += i + 1 < bytes.length ? B64_CHARS[((b1 & 0xf) << 2) | (b2 >> 6)] : "="
    out += i + 2 < bytes.length ? B64_CHARS[b2 & 0x3f] : "="
  }
  return out
}

module.exports = {
  caldavEnabled,
  caldavTzid,
  caldavResource,
  authHeader,
  buildVtodo,
}
