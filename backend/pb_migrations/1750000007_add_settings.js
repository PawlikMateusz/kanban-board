// Personal Kanban - app settings.
// A single record keeps device-independent preferences (currently the theme)
// so they sync across browsers/devices instead of living only in localStorage.
migrate((app) => {
  const settings = new Collection({
    type: "base",
    name: "settings",
    fields: [
      {
        type: "select",
        name: "theme",
        required: true,
        maxSelect: 1,
        values: ["light", "dark"],
        defaultValue: "light",
      },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  })
  app.save(settings)

  app.save(new Record(settings, { id: "appsettings0000", theme: "light" }))
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("settings"))
  } catch (_) {
    // already deleted
  }
})
