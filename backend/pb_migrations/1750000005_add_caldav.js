// Personal Kanban - optional CalDAV (Radicale) sync for iOS Reminders.
// This migration only adds the `caldavUrl` field (persists the "synced" state);
// the actual /api/caldav/* routes live in pb_hooks/caldav.pb.js.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  if (!collection.fields.some((f) => f.name === "caldavUrl")) {
    collection.fields.add(new TextField({ name: "caldavUrl" }))
  }
  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("tasks")
    const field = collection.fields.find((f) => f.name === "caldavUrl")
    if (field) collection.fields.remove(field.id)
    app.save(collection)
  } catch (_) {
    // already removed
  }
})
