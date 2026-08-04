// Personal Kanban - add `order` to projects so the sidebar can reorder them.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("projects")
  if (!collection.fields.some((f) => f.name === "order")) {
    collection.fields.add(new NumberField({ name: "order" }))
    app.save(collection)
  }
  // Backfill existing rows in creation order so sorting is stable.
  const records = app.findRecordsByFilter("projects", "", "created,id", 0, 0)
  records.forEach((r, i) => {
    r.set("order", (i + 1) * 1024)
    app.save(r)
  })
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("projects")
    const field = collection.fields.find((f) => f.name === "order")
    if (field) collection.fields.remove(field.id)
    app.save(collection)
  } catch (_) {
    // already removed
  }
})
