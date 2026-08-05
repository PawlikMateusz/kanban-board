// Personal Kanban - track the due date that was last synced to Radicale.
// `caldavDueDate` stores the raw due-date value at sync time so the frontend
// can warn when the card's due date drifted from what's on the calendar.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  if (!collection.fields.some((f) => f.name === "caldavDueDate")) {
    collection.fields.add(new TextField({ name: "caldavDueDate" }))
  }
  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("tasks")
    const field = collection.fields.find((f) => f.name === "caldavDueDate")
    if (field) collection.fields.remove(field.id)
    app.save(collection)
  } catch (_) {
    // already removed
  }
})
