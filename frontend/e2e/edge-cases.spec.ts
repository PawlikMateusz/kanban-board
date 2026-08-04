import { test, expect } from "@playwright/test"
import {
  cleanup,
  createProject,
  createTask,
  dashboardSectionCount,
  expandDashboardSection,
  utcDaysFromNow,
  waitForProject,
  wipeAllData,
} from "./helpers"

test.describe("TO – edge cases & data integrity", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  test("TO1 – empty database", async ({ page }) => {
    await wipeAllData()
    await page.goto("/")

    await expect(page.getByText("No projects yet.")).toBeVisible()
    // empty sections are omitted entirely
    for (const key of ["overdue", "today", "next3", "next7", "next14", "next30"]) {
      await expect(dashboardSectionCount(page, key)).toHaveCount(0)
    }
    await expect(page.getByText(/No tasks yet/)).toBeVisible()

    // QuickCreate is inert (no project to create in) – no crash, no modal
    await page.keyboard.press("n")
    await expect(page.getByPlaceholder("What needs to be done?")).toBeHidden()
  })

  test("TO2 – task title is long", async ({ page }) => {
    const project = await createProject("TO2 Project")
    const long = "TO2 " + "very long title ".repeat(20)
    await createTask({ project: project.id, title: long, dueDate: utcDaysFromNow(0) })

    await page.goto("/")
    await expandDashboardSection(page, "today")
    const card = page.locator('[data-testid="task-card"]', { hasText: "very long title" })
    await expect(card).toBeVisible()
    const box = await card.boundingBox()
    expect(box!.height).toBeLessThan(150)
  })

  test("TO3 – due date timezone", async ({ page }) => {
    const project = await createProject("TO3 Project")
    await createTask({ project: project.id, title: "TO3 today", dueDate: utcDaysFromNow(0) })

    await page.goto("/")
    await expect(
      page.locator('[data-testid="section-today"]').getByRole("button", { name: "TO3 today" })
    ).toBeVisible()
  })

  test("TO4 – comment/checklist on a freshly created task", async ({ page }) => {
    const project = await createProject("TO4 Project")
    const problems: string[] = []
    page.on("pageerror", (e) => problems.push(e.message))

    await page.goto("/")
    await waitForProject(page, "TO4 Project")
    await page.getByRole("button", { name: "New task" }).click()
    await page.getByPlaceholder("What needs to be done?").fill("TO4 fresh")
    await page.getByPlaceholder("What needs to be done?").press("Enter")

    // QuickCreate tasks have no due date, so they open from the project board.
    await page.goto(`/projects/${project.id}`)
    await page.locator('[data-testid="task-card"]', { hasText: "TO4 fresh" }).click()
    await page.getByPlaceholder("Add an item…").fill("TO4 item")
    await page.getByPlaceholder("Add an item…").press("Enter")
    await page.getByPlaceholder("Add a comment…").fill("TO4 comment")
    await page.getByPlaceholder("Add a comment…").press("Enter")

    await expect(page.getByText("TO4 item")).toBeVisible()
    await expect(page.getByText("TO4 comment")).toBeVisible()
    expect(problems).toEqual([])
  })

  test("TO5 – deleting the only project", async ({ page }) => {
    await wipeAllData()
    const project = await createProject("TO5 only project")
    await createTask({ project: project.id, title: "TO5 task" })

    const problems: string[] = []
    page.on("pageerror", (e) => problems.push(e.message))

    await page.goto("/settings")
    await page
      .locator("div.flex.items-center.gap-2")
      .filter({ has: page.locator('input[value="TO5 only project"]') })
      .first()
      .getByRole("button", { name: "Delete project" })
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "Delete" }).click()

    await expect(page.locator("main").getByText("No projects yet.")).toBeVisible()

    await page.goto("/")
    await expect(page.getByText("No projects yet.")).toBeVisible()
    await page.getByRole("button", { name: "New task" }).click()
    await expect(page.getByPlaceholder("What needs to be done?")).toBeHidden()
    expect(problems).toEqual([])
  })
})
