// Due dates are stored by PocketBase as UTC midnights ("2026-08-01 00:00:00.000Z").
// Comparing day components in UTC avoids timezone drift when a task is "due today".

export function utcDayMs(dueDate: string): number | null {
  if (!dueDate) return null
  const m = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return Date.UTC(+m[1], +m[2] - 1, +m[3])
}

export function todayUtcMs(): number {
  const d = new Date()
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function utcDateString(dueDate: string): string {
  if (!dueDate) return ""
  const m = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ""
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function utcMonthDay(dueDate: string): string | null {
  if (!dueDate) return null
  const m = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return `${MONTHS[+m[2] - 1]} ${+m[3]}`
}

/** Returns the due date as "MMM d" plus the time (e.g. "Aug 3, 18:00"). */
export function utcMonthDayTime(dueDate: string): string | null {
  const md = utcMonthDay(dueDate)
  if (!md) return null
  const m = dueDate.match(/[T ](\d{2}):(\d{2})/)
  return m ? `${md}, ${m[1]}:${m[2]}` : md
}
