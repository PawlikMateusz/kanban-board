// Personal Kanban - checklist items collection
migrate((app) => {
  const tasks = app.findCollectionByNameOrId("tasks")

  const checklistItems = new Collection({
    type: "base",
    name: "checklistItems",
    fields: [
      { type: "relation", name: "task", collectionId: tasks.id, maxSelect: 1, required: true, cascadeDelete: true },
      { type: "text", name: "text", required: true, max: 1000 },
      { type: "bool", name: "checked" },
      { type: "number", name: "order" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_checklist_task ON checklistItems (task)"],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  })
  app.save(checklistItems)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("checklistItems"))
  } catch (_) {
    // already deleted
  }
})
