import { test, expect } from "@playwright/test"
import {
  cleanup,
  createProject,
  createTask,
  expandDashboardSection,
  listChecklist,
  listTasks,
  utcDaysFromNow,
  wipeAllData,
} from "./helpers"

test.describe("TF – checklist", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  function drawer(page: import("@playwright/test").Page) {
    return page.locator('[data-testid="task-drawer"]')
  }

  function checklistForm(page: import("@playwright/test").Page) {
    return page.locator("form", { has: page.getByPlaceholder("Add an item…") })
  }

  async function openTask(page: import("@playwright/test").Page, title: string) {
    await expandDashboardSection(page, "today")
    await page.getByRole("button", { name: title }).first().click()
    await expect(page.getByPlaceholder("Add an item…")).toBeVisible()
  }

  async function addItem(page: import("@playwright/test").Page, text: string) {
    const input = page.getByPlaceholder("Add an item…")
    await input.fill(text)
    await checklistForm(page).getByRole("button", { name: "Add" }).click()
  }

  test("TF1 – add items", async ({ page }) => {
    const project = await createProject("TF Project")
    await createTask({ project: project.id, title: "TF1 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TF1 task")
    await addItem(page, "TF1 item one")
    await addItem(page, "TF1 item two")

    const items = drawer(page).locator('[data-testid="checklist-item"]')
    await expect(items).toHaveCount(2)
    await expect(page.getByRole("checkbox").first()).not.toBeChecked()
    await expect(page.getByRole("checkbox").nth(1)).not.toBeChecked()
    await expect(drawer(page).getByText("0/2")).toBeVisible()
  })

  test("TF2 – check an item", async ({ page }) => {
    const project = await createProject("TF Project")
    await createTask({ project: project.id, title: "TF2 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TF2 task")
    await addItem(page, "TF2 item one")
    await addItem(page, "TF2 item two")

    await page.getByRole("checkbox").first().click()
    await expect(drawer(page).getByText("1/2")).toBeVisible()

    const card = page.locator('[data-testid="task-card"]', { hasText: "TF2 task" })
    await expect(card.locator('[data-testid="checklist-progress"]')).toHaveText("1/2")
    await expect(card.locator(".bg-emerald-500")).toHaveAttribute("style", /width: 50%/)
  })

  test("TF3 – uncheck an item", async ({ page }) => {
    const project = await createProject("TF Project")
    const task = await createTask({ project: project.id, title: "TF3 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TF3 task")
    await addItem(page, "TF3 item one")
    await addItem(page, "TF3 item two")

    await page.getByRole("checkbox").first().click()
    await expect(drawer(page).getByText("1/2")).toBeVisible()
    await page.getByRole("checkbox").first().click()
    await expect(drawer(page).getByText("0/2")).toBeVisible()

    const items = await listChecklist(task.id)
    expect(items.filter((i) => i.checked)).toHaveLength(0)
  })

  test("TF4 – delete an item", async ({ page }) => {
    const project = await createProject("TF Project")
    await createTask({ project: project.id, title: "TF4 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TF4 task")
    await addItem(page, "TF4 item one")
    await addItem(page, "TF4 item two")

    const items = drawer(page).locator('[data-testid="checklist-item"]')
    await expect(items).toHaveCount(2)
    await items.first().getByRole("button", { name: "Delete item" }).click()
    await expect(items).toHaveCount(1)
    await drawer(page).locator('[data-testid="checklist-item"]').getByRole("button", { name: "Delete item" }).click()
    await expect(page.getByText("No items yet.")).toBeVisible()
  })

  test("TF5 – persistence", async ({ page }) => {
    const project = await createProject("TF Project")
    await createTask({ project: project.id, title: "TF5 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TF5 task")
    await addItem(page, "TF5 persisted item")

    await page.reload()
    await expandDashboardSection(page, "today")
    await expect(page.getByRole("button", { name: "TF5 task" })).toBeVisible()
    await page.getByRole("button", { name: "TF5 task" }).click()
    await expect(page.getByText("TF5 persisted item")).toBeVisible()
  })

  test("TF6 – cascade delete", async ({ page }) => {
    const project = await createProject("TF Project")
    const task = await createTask({ project: project.id, title: "TF6 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TF6 task")
    await addItem(page, "TF6 doomed item")
    await expect(page.getByText("TF6 doomed item")).toBeVisible()

    await page.getByRole("button", { name: "Delete task" }).click()

    await expect.poll(async () => (await listChecklist(task.id)).length).toBe(0)
  })

  test("TF7 – card progress bar", async ({ page }) => {
    const project = await createProject("TF Project")
    await createTask({ project: project.id, title: "TF7 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TF7 task")
    await addItem(page, "TF7 item one")
    await addItem(page, "TF7 item two")
    await page.getByRole("checkbox").first().click()
    await page.getByRole("checkbox").nth(1).click()

    const card = page.locator('[data-testid="task-card"]', { hasText: "TF7 task" })
    await expect(card.locator('[data-testid="checklist-progress"]')).toHaveText("2/2")
    await expect(card.locator(".bg-emerald-500")).toHaveAttribute("style", /width: 100%/)
  })
})
