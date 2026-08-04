import { test, expect } from "@playwright/test"
import {
  cleanup,
  column,
  columnCard,
  createProject,
  createTask,
  dashboardSection,
  expandDashboardSection,
  getTask,
  listTasks,
  pickSelectOption,
  taskCard,
  utcDaysFromNow,
  utcInputDate,
  wipeAllData,
} from "./helpers"

test.describe("TE – task details drawer", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  test("TE1 – open & close drawer", async ({ page }) => {
    const project = await createProject("TE Project")
    await createTask({ project: project.id, title: "TE1 task" })

    await page.goto(`/projects/${project.id}`)
    await taskCard(page, "TE1 task").click()

    await expect(page.getByPlaceholder("Task title")).toBeVisible()
    await expect(page).toHaveURL(/\/projects\//)

    await page.getByRole("button", { name: "Close" }).click()
    await expect(page.getByPlaceholder("Task title")).toBeHidden()
    await expect(page.getByText("Select a task to view details")).toBeVisible()

    // Esc also closes
    await taskCard(page, "TE1 task").click()
    await expect(page.getByPlaceholder("Task title")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByPlaceholder("Task title")).toBeHidden()
  })

  test("TE2 – edit title", async ({ page }) => {
    const project = await createProject("TE Project")
    const task = await createTask({ project: project.id, title: "TE2 original" })

    await page.goto(`/projects/${project.id}`)
    await taskCard(page, "TE2 original").click()

    const input = page.getByPlaceholder("Task title")
    await input.fill("TE2 renamed")
    await input.blur()

    await expect.poll(async () => (await getTask(task.id)).title).toBe("TE2 renamed")

    await page.getByRole("button", { name: "Close" }).click()
    await taskCard(page, "TE2 renamed").click()
    await expect(page.getByPlaceholder("Task title")).toHaveValue("TE2 renamed")
  })

  test("TE3 – edit description", async ({ page }) => {
    const project = await createProject("TE Project")
    const task = await createTask({ project: project.id, title: "TE3 task" })

    await page.goto(`/projects/${project.id}`)
    await taskCard(page, "TE3 task").click()

    const textarea = page.getByPlaceholder("Add a description…")
    await textarea.fill("TE3 new description")
    await textarea.blur()

    await expect.poll(async () => (await getTask(task.id)).description).toBe("TE3 new description")
  })

  test("TE4 – change status", async ({ page }) => {
    const project = await createProject("TE Project")
    await createTask({ project: project.id, title: "TE4 task", status: "todo", order: 1 })

    await page.goto(`/projects/${project.id}`)
    await taskCard(page, "TE4 task").click()

    await page.locator('[data-testid="drawer-status"]').click()
    await pickSelectOption(page, "Doing")

    // drawer stays open, card moves on the board
    await expect(page.getByPlaceholder("Task title")).toBeVisible()
    await expect(columnCard(page, "doing", "TE4 task")).toBeVisible()
    await expect(columnCard(page, "todo", "TE4 task")).toHaveCount(0)
    await expect
      .poll(async () => {
        const id = (await listTasks()).find((x) => x.title === "TE4 task")!.id
        return (await getTask(id)).status
      })
      .toBe("doing")
  })

  test("TE5 – set / clear due date", async ({ page }) => {
    const project = await createProject("TE Project")
    await createTask({ project: project.id, title: "TE5 date", dueDate: utcDaysFromNow(0) })

    await page.goto("/")
    await expandDashboardSection(page, "today")
    await page.getByRole("button", { name: "TE5 date" }).click()

    await page.locator('[data-testid="due-date-trigger"]').click()
    await page.locator(`[data-testid="dp-day-${utcInputDate(0)}"]`).click()
    await page.getByPlaceholder("Task title").click()
    await expect(
      dashboardSection(page, "today").getByRole("button", { name: "TE5 date" })
    ).toBeVisible()

    // Clearing the due date removes the task from the dashboard timeline
    // (there is no "No due date" section anymore).
    await page.locator('[data-testid="due-date-trigger"]').click()
    await page.getByRole("button", { name: "Clear" }).click()
    await page.keyboard.press("Escape")
    await expect(
      dashboardSection(page, "today").getByRole("button", { name: "TE5 date" })
    ).toHaveCount(0)
    await expect(
      dashboardSection(page, "overdue").getByRole("button", { name: "TE5 date" })
    ).toHaveCount(0)
  })

  test("TE6 – delete task", async ({ page }) => {
    const project = await createProject("TE Project")
    const task = await createTask({ project: project.id, title: "TE6 delete", dueDate: utcDaysFromNow(0) })

    await page.goto("/")
    await expandDashboardSection(page, "today")
    await page.getByRole("button", { name: "TE6 delete" }).click()
    await page.getByRole("button", { name: "Delete task" }).click()

    await expect(page.getByPlaceholder("Task title")).toBeHidden()
    await expect(page.getByRole("button", { name: "TE6 delete" })).toHaveCount(0)
    await expect
      .poll(async () => {
        try {
          await getTask(task.id)
          return "exists"
        } catch {
          return "gone"
        }
      })
      .toBe("gone")
  })

  test("TE7 – drawer state across tasks", async ({ page }) => {
    const project = await createProject("TE Project")
    await createTask({ project: project.id, title: "TE7 task A", status: "todo", order: 1 })
    await createTask({ project: project.id, title: "TE7 task B", status: "todo", order: 2 })

    await page.goto(`/projects/${project.id}`)

    await taskCard(page, "TE7 task A").click()
    await expect(page.getByPlaceholder("Task title")).toHaveValue("TE7 task A")
    await page.getByRole("button", { name: "Close" }).click()

    await taskCard(page, "TE7 task B").click()
    await expect(page.getByPlaceholder("Task title")).toHaveValue("TE7 task B")
  })

  test("TE8 – move task to another project", async ({ page }) => {
    const projectA = await createProject("TE8 A")
    const projectB = await createProject("TE8 B")
    await createTask({ project: projectA.id, title: "TE8 task", status: "todo", order: 1024 })
    await createTask({ project: projectB.id, title: "TE8 existing", status: "todo", order: 1024 })

    await page.goto(`/projects/${projectA.id}`)
    await taskCard(page, "TE8 task").click()

    await page.locator('[data-testid="drawer-project"]').click()
    await pickSelectOption(page, "TE8 B")

    // drawer stays open, card leaves project A's board
    await expect(page.getByPlaceholder("Task title")).toBeVisible()
    await expect(columnCard(page, "todo", "TE8 task")).toHaveCount(0)

    // card now lives in project B, placed after its existing todo task
    await page.goto(`/projects/${projectB.id}`)
    await expect(columnCard(page, "todo", "TE8 task")).toBeVisible()
    const tasks = await listTasks()
    const moved = tasks.find((t) => t.title === "TE8 task")!
    const existing = tasks.find((t) => t.title === "TE8 existing")!
    expect(moved.project).toBe(projectB.id)
    expect(moved.order).toBeGreaterThan(existing.order)

    // persists after a full reload
    await page.reload()
    await expect(columnCard(page, "todo", "TE8 task")).toBeVisible()
  })
})
