// Add the created/updated autodate fields to existing collections.
// The initial migration (1750000000) omitted them, so records had no
// created/updated values and sorting by them returned 400, breaking all
// getFullList() calls in the frontend.
migrate((app) => {
  const names = ["projects", "labels", "tasks", "comments"]
  for (const name of names) {
    const collection = app.findCollectionByNameOrId(name)
    const hasCreated = collection.fields.some((f) => f.name === "created")
    const hasUpdated = collection.fields.some((f) => f.name === "updated")
    if (hasCreated && hasUpdated) continue
    if (!hasCreated) {
      collection.fields.add(
        new AutodateField({ name: "created", onCreate: true, onUpdate: false })
      )
    }
    if (!hasUpdated) {
      collection.fields.add(
        new AutodateField({ name: "updated", onCreate: true, onUpdate: true })
      )
    }
    app.save(collection)
    // Backfill existing rows so the frontend can sort/compare by created/updated.
    const now = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "") + ".000Z"
    app.db()
      .newQuery(`UPDATE ${name} SET created = {:now}, updated = {:now} WHERE (created IS NULL OR created = '')`)
      .bind({ now })
      .execute()
  }
}, (app) => {
  // undo: remove the autodate fields again
  for (const name of ["projects", "labels", "tasks", "comments"]) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      for (const field of collection.fields) {
        if ((field.name === "created" || field.name === "updated") && field.type() === "autodate") {
          collection.fields.remove(field.id)
        }
      }
      app.save(collection)
    } catch (_) {
      // already removed
    }
  }
})
