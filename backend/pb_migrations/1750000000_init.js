// Personal Kanban - initial collections + Inbox project seed
migrate((app) => {
  const projects = new Collection({
    type: "base",
    name: "projects",
    fields: [
      { type: "text", name: "name", required: true, max: 200 },
      { type: "text", name: "color", max: 50 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  })
  app.save(projects)

  const labels = new Collection({
    type: "base",
    name: "labels",
    fields: [
      { type: "text", name: "name", required: true, max: 200 },
      { type: "text", name: "color", max: 50 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  })
  app.save(labels)

  const tasks = new Collection({
    type: "base",
    name: "tasks",
    fields: [
      { type: "relation", name: "project", collectionId: projects.id, maxSelect: 1, required: true, cascadeDelete: true },
      { type: "text", name: "title", max: 500 },
      { type: "text", name: "description" },
      { type: "select", name: "status", required: true, maxSelect: 1, values: ["todo", "doing", "done"], defaultValue: "todo" },
      { type: "date", name: "dueDate" },
      { type: "number", name: "order" },
      { type: "relation", name: "labels", collectionId: labels.id, maxSelect: 100 },
      { type: "file", name: "attachments", maxSelect: 20, maxSize: 20971520 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_tasks_project ON tasks (project)",
      "CREATE INDEX idx_tasks_status ON tasks (status)",
    ],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  })
  app.save(tasks)

  const comments = new Collection({
    type: "base",
    name: "comments",
    fields: [
      { type: "relation", name: "task", collectionId: tasks.id, maxSelect: 1, required: true, cascadeDelete: true },
      { type: "text", name: "text", required: true },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_comments_task ON comments (task)"],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  })
  app.save(comments)

  const inbox = new Record(projects, {
    id: "inbox0000000000",
    name: "Inbox",
    color: "#6366f1",
  })
  app.save(inbox)
}, (app) => {
  for (const name of ["comments", "tasks", "labels", "projects"]) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (_) {
      // already deleted
    }
  }
})
