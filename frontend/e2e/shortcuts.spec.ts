import { test, expect } from "@playwright/test"
import {
  cleanup,
  createProject,
  createTask,
  listTasks,
  waitForProject,
  wipeAllData,
} from "./helpers"

test.describe("TL – keyboard shortcuts", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  test("TL1 – N opens QuickCreate", async ({ page }) => {
    const project = await createProject("TL Project")

    await page.goto("/")
    await waitForProject(page, "TL Project")
    await page.keyboard.press("n")
    await expect(page.getByPlaceholder("What needs to be done?")).toBeVisible()
    await page.keyboard.press("Escape")

    await page.locator("aside").getByPlaceholder("Search tasks…").focus()
    await page.keyboard.press("n")
    await expect(page.getByPlaceholder("What needs to be done?")).toBeHidden()

    await page.goto(`/projects/${project.id}`)
    await waitForProject(page, "TL Project")
    await page.keyboard.press("n")
    await expect(page.getByPlaceholder("What needs to be done?")).toBeVisible()
  })

  test("TL2 – Enter saves, Esc cancels", async ({ page }) => {
    const project = await createProject("TL Project")
    await page.goto("/")
    await waitForProject(page, "TL Project")

    // QuickCreate: Enter saves (a task without a due date lives on its board).
    await page.keyboard.press("n")
    await page.getByPlaceholder("What needs to be done?").fill("TL2 saved")
    await page.getByPlaceholder("What needs to be done?").press("Enter")
    await page.goto(`/projects/${project.id}`)
    await expect(page.locator('[data-testid="task-card"]', { hasText: "TL2 saved" })).toBeVisible()

    // QuickCreate: Esc cancels (no leftover empty task)
    await page.keyboard.press("n")
    await page.getByPlaceholder("What needs to be done?").press("Escape")
    await expect(page.getByPlaceholder("What needs to be done?")).toBeHidden()

    // Checklist input: Enter adds
    await page.locator('[data-testid="task-card"]', { hasText: "TL2 saved" }).click()
    const checklistInput = page.getByPlaceholder("Add an item…")
    await checklistInput.fill("TL2 item")
    await checklistInput.press("Enter")
    await expect(page.getByText("TL2 item")).toBeVisible()

    // Comment input: Enter adds
    const commentInput = page.getByPlaceholder("Add a comment…")
    await commentInput.fill("TL2 comment")
    await commentInput.press("Enter")
    await expect(page.getByText("TL2 comment")).toBeVisible()
  })
})
