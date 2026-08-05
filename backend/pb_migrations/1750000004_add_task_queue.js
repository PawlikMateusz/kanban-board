// Personal Kanban - queue for cards without a due date.
// `queued` flags the card as being in the no-due queue, `queueOrder` holds its
// gap-based position within that queue (single list across all projects).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  if (!collection.fields.some((f) => f.name === "queued")) {
    collection.fields.add(new BoolField({ name: "queued" }))
  }
  if (!collection.fields.some((f) => f.name === "queueOrder")) {
    collection.fields.add(new NumberField({ name: "queueOrder" }))
  }
  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("tasks")
    for (const name of ["queued", "queueOrder"]) {
      const field = collection.fields.find((f) => f.name === name)
      if (field) collection.fields.remove(field.id)
    }
    app.save(collection)
  } catch (_) {
    // already removed
  }
})
