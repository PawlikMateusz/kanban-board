// Optional CalDAV (Radicale) sync for iOS Reminders.
//
// Pushes a task with a due date to a Radicale calendar as a VTODO so it shows
// up as a Reminder on the iPhone. Only the due date is synced (there are no
// reminders/alarms on the Radicale side); the entry mirrors what the iOS
// Reminders app writes, with DTSTART/DUE in the local timezone. Fully optional:
// the routes report `enabled: false` unless RADICALE_URL, RADICALE_USER and
// RADICALE_PASSWORD are set.
//
//   GET  /api/caldav/config  -> { "enabled": true|false }
//   POST /api/caldav/sync    -> { taskId }
//   POST /api/caldav/remove  -> { taskId }
//
// Helper functions live in caldav.js and must be required inside each handler
// (hook handlers run in isolated contexts).

routerAdd("GET", "/api/caldav/config", (e) => {
  const caldav = require(`${__hooks}/caldav.js`)
  return e.json(200, { enabled: caldav.caldavEnabled() })
})

routerAdd("POST", "/api/caldav/sync", (e) => {
  const caldav = require(`${__hooks}/caldav.js`)
  if (!caldav.caldavEnabled()) throw new BadRequestError("CalDAV is not configured")

  const body = new DynamicModel({ taskId: "" })
  e.bindBody(body)

  const taskId = body.taskId || ""
  if (!taskId) throw new BadRequestError("Missing task id")

  const task = e.app.findRecordById("tasks", taskId)
  const rawDue = (task.getString("dueDate") || "").replace(" ", "T")
  const dueDate = rawDue ? new Date(rawDue) : null
  if (!dueDate || isNaN(dueDate.getTime())) throw new BadRequestError("Task has no due date")

  const ics = caldav.buildVtodo(task)
  const url = caldav.caldavResource(taskId)

  let res
  try {
    res = $http.send({
      url: url,
      method: "PUT",
      body: ics,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        Authorization: caldav.authHeader(),
      },
      timeout: 30,
    })
  } catch (err) {
    e.app.logger().error("CalDAV sync request failed", "error", err)
    throw new InternalServerError("Failed to reach Radicale: " + err)
  }

  if (res.statusCode >= 200 && res.statusCode < 300) {
    task.set("caldavUrl", url)
    task.set("caldavDueDate", task.getString("dueDate"))
    e.app.save(task)
    return e.json(200, { success: true, resource: url })
  }

  e.app
    .logger()
    .error("CalDAV sync rejected", "status", res.statusCode, "body", toString(res.body))
  throw new InternalServerError("Radicale returned HTTP " + res.statusCode)
})

routerAdd("POST", "/api/caldav/remove", (e) => {
  const caldav = require(`${__hooks}/caldav.js`)
  if (!caldav.caldavEnabled()) throw new BadRequestError("CalDAV is not configured")

  const body = new DynamicModel({ taskId: "" })
  e.bindBody(body)

  const taskId = body.taskId || ""
  if (!taskId) throw new BadRequestError("Missing task id")

  const task = e.app.findRecordById("tasks", taskId)
  // Prefer the stored resource URL so we never touch anything but our own
  // entry, even if the RADICALE_URL config changed since the last sync.
  const url = task.getString("caldavUrl") || caldav.caldavResource(taskId)

  let res
  try {
    res = $http.send({
      url: url,
      method: "DELETE",
      headers: { Authorization: caldav.authHeader() },
      timeout: 30,
    })
  } catch (err) {
    e.app.logger().error("CalDAV remove request failed", "error", err)
    throw new InternalServerError("Failed to reach Radicale: " + err)
  }

  if ((res.statusCode >= 200 && res.statusCode < 300) || res.statusCode === 404) {
    task.set("caldavUrl", "")
    task.set("caldavDueDate", "")
    e.app.save(task)
    return e.json(200, { success: true })
  }

  e.app
    .logger()
    .error("CalDAV remove rejected", "status", res.statusCode, "body", toString(res.body))
  throw new InternalServerError("Radicale returned HTTP " + res.statusCode)
})
