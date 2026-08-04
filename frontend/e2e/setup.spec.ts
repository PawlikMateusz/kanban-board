import { test, expect } from "@playwright/test"
import {
  cleanup,
  createChecklistItem,
  createComment,
  createLabel,
  createProject,
  createTask,
  getTask,
  listChecklist,
  listComments,
  listLabels,
  listProjects,
  listTasks,
  uploadAttachment,
  utcDaysFromNow,
} from "./helpers"

test.describe("TA – setup & data seeding", () => {
  test.afterAll(() => cleanup())

  test("TA1 – seed test fixtures", async () => {
    const inbox = await createProject("Inbox", "#6366f1")
    const life = await createProject("Life", "#22c55e")
    const urgent = await createLabel("urgent", "#ef4444")
    const home = await createLabel("home", "#f59e0b")

    await createTask({ project: inbox.id, title: "TA1 overdue", status: "todo", dueDate: utcDaysFromNow(-1) })
    await createTask({ project: inbox.id, title: "TA1 today", status: "doing", dueDate: utcDaysFromNow(0) })
    await createTask({
      project: life.id,
      title: "TA1 later",
      status: "done",
      dueDate: utcDaysFromNow(10),
      labels: [urgent.id, home.id],
    })
    const checklistTask = await createTask({ project: life.id, title: "TA1 checklist" })
    await createChecklistItem(checklistTask.id, "step one")
    const commentTask = await createTask({ project: inbox.id, title: "TA1 comment" })
    await createComment(commentTask.id, "a seeded comment")
    const attachTask = await createTask({ project: inbox.id, title: "TA1 attachment" })
    await uploadAttachment(attachTask.id, "note.txt")

    const tasks = await listTasks()
    expect(tasks.filter((t) => t.title.startsWith("TA1 "))).toHaveLength(6)

    const projects = await listProjects()
    expect(projects.map((p) => p.name)).toEqual(expect.arrayContaining(["Inbox", "Life"]))

    const labels = await listLabels()
    expect(labels.map((l) => l.name)).toEqual(expect.arrayContaining(["urgent", "home"]))

    const later = tasks.find((t) => t.title === "TA1 later")
    expect(later?.labels.sort()).toEqual([urgent.id, home.id].sort())

    expect((await listComments(commentTask.id))).toHaveLength(1)
    expect((await listChecklist(checklistTask.id))).toHaveLength(1)
    expect((await getTask(attachTask.id)).attachments).toHaveLength(1)
  })
})
