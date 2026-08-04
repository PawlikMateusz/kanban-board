import { test, expect } from "@playwright/test"
import {
  cleanup,
  columnCard,
  createProject,
  createTask,
  expandDashboardSection,
  getTask,
  taskCard,
  utcDaysFromNow,
  utcDaysFromNowAtHour,
  utcInputDate,
  wipeAllData,
} from "./helpers"

test.describe("NFR – dashboard complete button, due time suggestions & card times", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  test("NFR1 – complete button appears on dashboard hover and marks the task done", async ({ page }) => {
    const project = await createProject("NFR Project")
    const task = await createTask({ project: project.id, title: "NFR hover", dueDate: utcDaysFromNow(0) })

    await page.goto("/")
    await expandDashboardSection(page, "today")

    const completeBtn = page.locator('[data-testid="complete-task"]').first()
    const card = taskCard(page, "NFR hover")

    // Hidden until the mouse is over the task row.
    await expect(completeBtn).toHaveCSS("opacity", "0")

    await card.hover()
    await expect(completeBtn).toHaveCSS("opacity", "1")

    await completeBtn.click()

    // Task disappears from the dashboard and its status becomes "done".
    await expect(card).toHaveCount(0)
    await expect.poll(async () => (await getTask(task.id)).status).toBe("done")
  })

  test("NFR2 – due picker defaults to 18:00, offers suggestions, custom time hidden", async ({ page }) => {
    const project = await createProject("NFR Project")
    const task = await createTask({ project: project.id, title: "NFR due" })

    // No due date yet, so the picker applies its default 18:00 when a day is picked.
    await page.goto(`/projects/${project.id}`)
    await page.locator('[data-testid="task-card"]', { hasText: "NFR due" }).click()

    await page.locator('[data-testid="due-date-trigger"]').click()

    // Quick-set suggestion buttons are shown.
    for (const h of [9, 12, 15, 18, 21]) {
      await expect(page.locator(`[data-testid="dp-time-${h}"]`)).toBeVisible()
    }
    // Concrete time inputs are hidden by default; only the link to reveal them shows.
    await expect(page.locator('[data-testid="dp-custom-time"]')).toBeVisible()
    await expect(page.locator('[data-testid="dp-hour"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="dp-minute"]')).toHaveCount(0)

    // Picking a day applies the default 18:00.
    await page.locator(`[data-testid="dp-day-${utcInputDate(0)}"]`).click()
    await expect.poll(async () => (await getTask(task.id)).dueDate).toMatch(/18:00/)

    // Revealing the custom time picker lets you pick a concrete hour.
    await page.locator('[data-testid="dp-custom-time"]').click()
    await page.locator('[data-testid="dp-hour"]').selectOption("9")
    await expect.poll(async () => (await getTask(task.id)).dueDate).toMatch(/09:00/)
  })

  test("NFR3 – due time appears on cards in dashboard and board views", async ({ page }) => {
    const project = await createProject("NFR Project")
    await createTask({
      project: project.id,
      title: "NFR time",
      dueDate: utcDaysFromNowAtHour(0, 18),
    })

    await page.goto("/")
    await expandDashboardSection(page, "today")
    await expect(taskCard(page, "NFR time")).toContainText("18:00")

    await page.goto(`/projects/${project.id}`)
    await expect(columnCard(page, "todo", "NFR time")).toContainText("18:00")
  })
})
