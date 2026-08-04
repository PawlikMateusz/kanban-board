import { test, expect } from "@playwright/test"
import {
  cleanup,
  createLabel,
  createProject,
  createTask,
  expandDashboardSection,
  getTask,
  listLabels,
  listTasks,
  taskCard,
  utcDaysFromNow,
  wipeAllData,
} from "./helpers"

test.describe("TI – labels", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  function labelSection(page: import("@playwright/test").Page) {
    return page.locator("section").filter({ has: page.getByRole("heading", { name: "Labels" }) })
  }

  function labelRow(page: import("@playwright/test").Page, name: string) {
    return page
      .locator("div.flex.items-center.gap-2")
      .filter({ has: page.locator(`input[value="${name}"]`) })
      .first()
  }

  test("TI1 – create label in Settings", async ({ page }) => {
    await page.goto("/settings")

    const section = labelSection(page)
    await section.getByPlaceholder("Label name").fill("TI1 label")
    await section.getByRole("button", { name: "Pick color" }).click()
    await page.getByRole("button", { name: "#ef4444" }).click()
    await section.getByRole("button", { name: "Add" }).click()

    await expect(section.locator('input[value="TI1 label"]')).toBeVisible()

    const labels = await listLabels()
    const label = labels.find((l) => l.name === "TI1 label")
    expect(label?.color).toBe("#ef4444")
  })

  test("TI2 – rename & recolor label", async ({ page }) => {
    await createLabel("TI2 old", "#6366f1")
    await page.goto("/settings")

    const row = labelRow(page, "TI2 old")
    const input = row.locator("input")
    await input.fill("TI2 new")
    await input.blur()

    await expect.poll(async () => (await listLabels()).find((l) => l.name === "TI2 new")).toBeTruthy()

    // row is re-queried because its filter matched the old name
    await labelRow(page, "TI2 new").getByRole("button", { name: "Pick color" }).click()
    await page.getByRole("button", { name: "#22c55e" }).click()

    await expect.poll(async () => {
      const label = (await listLabels()).find((l) => l.name === "TI2 new")
      return label?.color
    }).toBe("#22c55e")
  })

  test("TI3 – delete label", async ({ page }) => {
    const project = await createProject("TI3 Project")
    const label = await createLabel("TI3 label", "#ef4444")
    const task = await createTask({ project: project.id, title: "TI3 task", labels: [label.id] })

    await page.goto("/settings")

    const section = labelSection(page)
    await labelRow(page, "TI3 label").getByRole("button", { name: "Delete label" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "Delete" }).click()

    await expect(section.locator('input[value="TI3 label"]')).toHaveCount(0)
    await expect.poll(async () => (await getTask(task.id)).labels).toEqual([])
    await expect.poll(async () => (await listLabels()).find((l) => l.name === "TI3 label")).toBeFalsy()
  })

  test("TI4 – apply labels to task", async ({ page }) => {
    const project = await createProject("TI4 Project")
    const label = await createLabel("TI4 label", "#f59e0b")
    const task = await createTask({ project: project.id, title: "TI4 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")
    await expandDashboardSection(page, "today")

    await page.getByRole("button", { name: "TI4 task" }).click()
    await page.getByRole("button", { name: "Add labels" }).click()
    await page.getByRole("button", { name: "TI4 label" }).click()

    await expect.poll(async () => (await getTask(task.id)).labels).toEqual([label.id])

    const card = page.locator('[data-testid="task-card"]', { hasText: "TI4 task" })
    await expect(card).toContainText("TI4 label")
    await expect(page.locator('[data-testid="task-drawer"]')).toContainText("TI4 label")
  })

  test("TI5 – labels are global", async ({ page }) => {
    const projectA = await createProject("TI5 Project A")
    const projectB = await createProject("TI5 Project B")
    await createLabel("TI5 global", "#6366f1")
    await createTask({ project: projectA.id, title: "TI5 task A" })
    const taskB = await createTask({ project: projectB.id, title: "TI5 task B" })

    await page.goto(`/projects/${projectA.id}`)
    await taskCard(page, "TI5 task A").click()
    await page.getByRole("button", { name: "Add labels" }).click()
    await expect(page.getByRole("button", { name: "TI5 global" })).toBeVisible()
    await page.getByRole("button", { name: "TI5 global" }).click()
    await expect.poll(async () => (await listTasks()).find((t) => t.title === "TI5 task A")?.labels).toHaveLength(1)

    await page.getByRole("button", { name: "Close" }).click()
    await page.goto(`/projects/${projectB.id}`)
    await taskCard(page, "TI5 task B").click()
    await page.getByRole("button", { name: "Add labels" }).click()
    await expect(page.getByRole("button", { name: "TI5 global" })).toBeVisible()
    await page.getByRole("button", { name: "TI5 global" }).click()
    await expect.poll(async () => (await getTask(taskB.id)).labels).toHaveLength(1)
  })
})
