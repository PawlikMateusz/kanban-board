import { test, expect } from "@playwright/test"
import {
  cleanup,
  column,
  createLabel,
  createProject,
  createTask,
  dashboardSection,
  dragHandleTo,
  expandDashboardSection,
  getTask,
  listChecklist,
  listLabels,
  listProjects,
  utcDaysFromNow,
  wipeAllData,
} from "./helpers"

test.describe("NF – new features", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  test("NF1 – in-progress tasks are not grouped into an In Progress section", async ({
    page,
  }) => {
    const project = await createProject("NF1 Project")
    await createTask({ project: project.id, title: "NF1 doing", status: "doing" })
    await createTask({ project: project.id, title: "NF1 doing today", status: "doing", dueDate: utcDaysFromNow(0) })

    await page.goto("/")

    // There is no In Progress section on the dashboard.
    await expect(dashboardSection(page, "inprogress")).toHaveCount(0)
    // A doing task without a due date is not shown on the dashboard.
    await expect(page.getByRole("button", { name: "NF1 doing", exact: true })).toHaveCount(0)
    // A doing task with a due date shows in its date section.
    await expect(
      dashboardSection(page, "today").getByRole("button", { name: "NF1 doing today" })
    ).toBeVisible()
  })

  test("NF2 – tasks without a due date stay on their project board", async ({ page }) => {
    const project = await createProject("NF2 Project")
    await createTask({ project: project.id, title: "NF2 nodate" })

    await page.goto("/")
    // No "No due date" section: the task only appears on its project board.
    await expect(dashboardSection(page, "today")).toHaveCount(0)
    await page.goto(`/projects/${project.id}`)
    await expect(
      column(page, "todo").locator('[data-testid="task-card"]', { hasText: "NF2 nodate" })
    ).toBeVisible()
  })

  test("NF3 – done tasks are hidden from the dashboard timeline", async ({ page }) => {
    const project = await createProject("NF3 Project")
    await createTask({
      project: project.id,
      title: "NF3 done overdue",
      status: "done",
      dueDate: utcDaysFromNow(-1),
    })
    await createTask({ project: project.id, title: "NF3 done nodate", status: "done" })
    await createTask({ project: project.id, title: "NF3 open", dueDate: utcDaysFromNow(0) })

    await page.goto("/")

    await expect(
      dashboardSection(page, "overdue").getByRole("button", { name: "NF3 done overdue" })
    ).toHaveCount(0)
    await expect(
      dashboardSection(page, "today").getByRole("button", { name: "NF3 done nodate" })
    ).toHaveCount(0)
    await expect(
      dashboardSection(page, "today").getByRole("button", { name: "NF3 open" })
    ).toBeVisible()
    await expect(dashboardSection(page, "overdue").getByRole("button", { name: "NF3 open" })).toHaveCount(0)
  })

  test("NF4 – Next 14 / Next 30 sections are labelled correctly", async ({ page }) => {
    const project = await createProject("NF4 Project")
    await createTask({ project: project.id, title: "NF4 next14", dueDate: utcDaysFromNow(10) })
    await createTask({ project: project.id, title: "NF4 next30", dueDate: utcDaysFromNow(20) })

    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Next 14 days" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Next 30 days" })).toBeVisible()
  })

  test("NF5 – projects can be reordered in the sidebar", async ({ page }) => {
    const a = await createProject("NF5 A")
    const b = await createProject("NF5 B")
    const c = await createProject("NF5 C")

    await page.goto("/")
    await expect(page.locator("aside").getByRole("link", { name: /NF5 A/ })).toBeVisible()

    // Drag project C above project A using its grip handle.
    await dragHandleTo(
      page,
      page.locator('aside button[aria-label="Reorder NF5 C"]'),
      page.locator('aside button[aria-label="Reorder NF5 A"]')
    )

    await expect
      .poll(async () => {
        const projects = await listProjects()
        const order = (id: string) => projects.find((p) => p.id === id)?.order ?? -1
        return order(c.id) < order(a.id) && order(a.id) < order(b.id)
      })
      .toBe(true)

    // Sidebar shows the new order: C before A before B.
    const links = page.locator("aside").getByRole("link", { name: /NF5 (A|B|C)/ })
    await expect(links.nth(0)).toContainText("NF5 C")
    await expect(links.nth(1)).toContainText("NF5 A")
    await expect(links.nth(2)).toContainText("NF5 B")
  })

  test("NF6 – checklist items can be reordered", async ({ page }) => {
    const project = await createProject("NF6 Project")
    const task = await createTask({ project: project.id, title: "NF6 task", dueDate: utcDaysFromNow(0) })

    await page.goto("/")
    await expandDashboardSection(page, "today")
    await page.getByRole("button", { name: "NF6 task" }).click()

    for (const t of ["first", "second", "third"]) {
      await page.getByPlaceholder("Add an item…").fill(t)
      await page.getByPlaceholder("Add an item…").press("Enter")
    }

    const items = page.locator('[data-testid="checklist-item"]')
    await expect(items).toHaveCount(3)
    await expect(items.nth(0)).toContainText("first")

    await dragHandleTo(
      page,
      items.nth(2).getByRole("button", { name: "Reorder item" }),
      items.nth(0).getByRole("button", { name: "Reorder item" })
    )

    await expect(items.nth(0)).toContainText("third")
    await expect
      .poll(async () => (await listChecklist(task.id)).map((i) => i.text))
      .toEqual(["third", "first", "second"])
  })

  test("NF7 – label filter page lists all cards by label", async ({ page }) => {
    const project = await createProject("NF7 Project")
    const label = await createLabel("NF7 label")
    await createTask({ project: project.id, title: "NF7 tagged", labels: [label.id] })
    await createTask({ project: project.id, title: "NF7 untagged" })

    await page.goto("/")

    // Sidebar Labels section is collapsed by default.
    await expect(page.locator("aside").getByRole("link", { name: /NF7 label/ })).toHaveCount(0)
    await page.locator("aside").getByRole("button", { name: "Labels" }).click()
    await page.locator("aside").getByRole("link", { name: /NF7 label/ }).click()

    await expect(page.getByRole("heading", { name: "NF7 label" })).toBeVisible()
    await expect(page.getByRole("button", { name: "NF7 tagged" })).toBeVisible()
    await expect(page.getByRole("button", { name: "NF7 untagged" })).toHaveCount(0)
  })

  test("NF8 – create label from task drawer", async ({ page }) => {
    const project = await createProject("NF8 Project")
    const task = await createTask({ project: project.id, title: "NF8 task", dueDate: utcDaysFromNow(0) })

    await page.goto("/")
    await expandDashboardSection(page, "today")
    await page.getByRole("button", { name: "NF8 task" }).click()

    await page.getByRole("button", { name: "Add labels" }).click()
    await page.getByPlaceholder("Search or create label…").fill("NF8 new label")
    await page.getByRole("button", { name: 'Create "NF8 new label"' }).click()

    await expect
      .poll(async () => (await getTask(task.id)).labels)
      .toHaveLength(1)
    await expect
      .poll(async () => (await listLabels()).find((l) => l.name === "NF8 new label"))
      .toBeTruthy()
    await expect(page.locator('[data-testid="task-drawer"]')).toContainText("NF8 new label")
  })
})
