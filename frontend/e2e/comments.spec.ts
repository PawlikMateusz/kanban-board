import { test, expect } from "@playwright/test"
import { cleanup, createProject, createTask, expandDashboardSection, utcDaysFromNow, wipeAllData } from "./helpers"

test.describe("TG – comments", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  function drawer(page: import("@playwright/test").Page) {
    return page.locator('[data-testid="task-drawer"]')
  }

  function commentForm(page: import("@playwright/test").Page) {
    return page.locator("form", { has: page.getByPlaceholder("Add a comment…") })
  }

  async function openTask(page: import("@playwright/test").Page, title: string) {
    await expandDashboardSection(page, "today")
    await page.getByRole("button", { name: title }).first().click()
    await expect(page.getByPlaceholder("Add a comment…")).toBeVisible()
  }

  async function addComment(page: import("@playwright/test").Page, text: string) {
    const input = page.getByPlaceholder("Add a comment…")
    await input.fill(text)
    await commentForm(page).getByRole("button", { name: "Add" }).click()
  }

  test("TG1 – add comment", async ({ page }) => {
    const project = await createProject("TG Project")
    await createTask({ project: project.id, title: "TG1 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TG1 task")
    await expect(page.getByText("No comments yet.")).toBeVisible()

    await addComment(page, "TG1 first comment")
    await addComment(page, "TG1 second comment")

    const comments = drawer(page).locator('[data-testid="comment"]')
    await expect(comments).toHaveCount(2)
    await expect(comments.nth(0)).toContainText("TG1 first comment")
    await expect(comments.nth(1)).toContainText("TG1 second comment")
    await expect(page.getByPlaceholder("Add a comment…")).toHaveValue("")
  })

  test("TG2 – comment count icon updates live", async ({ page }) => {
    const project = await createProject("TG Project")
    await createTask({ project: project.id, title: "TG2 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    const card = page.locator('[data-testid="task-card"]', { hasText: "TG2 task" })
    await expect(card.locator('[data-testid="comment-count"]')).toHaveCount(0)

    await openTask(page, "TG2 task")
    await addComment(page, "TG2 first comment")

    await expect(card.locator('[data-testid="comment-count"]')).toHaveText("1")
  })

  test("TG3 – delete comment", async ({ page }) => {
    const project = await createProject("TG Project")
    await createTask({ project: project.id, title: "TG3 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TG3 task")
    await addComment(page, "TG3 comment")

    const card = page.locator('[data-testid="task-card"]', { hasText: "TG3 task" })
    await expect(card.locator('[data-testid="comment-count"]')).toHaveText("1")

    await drawer(page).locator('[data-testid="comment"]').getByRole("button", { name: "Delete comment" }).click()

    await expect(drawer(page).locator('[data-testid="comment"]')).toHaveCount(0)
    await expect(card.locator('[data-testid="comment-count"]')).toHaveCount(0)
  })

  test("TG4 – empty state", async ({ page }) => {
    const project = await createProject("TG Project")
    await createTask({ project: project.id, title: "TG4 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TG4 task")
    await expect(page.getByText("No comments yet.")).toBeVisible()
  })

  test("TG5 – persistence & ordering", async ({ page }) => {
    const project = await createProject("TG Project")
    await createTask({ project: project.id, title: "TG5 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TG5 task")
    await addComment(page, "TG5 old")
    await addComment(page, "TG5 new")
    await expect(drawer(page).locator('[data-testid="comment"]')).toHaveCount(2)

    await page.reload()
    await expandDashboardSection(page, "today")
    await page.getByRole("button", { name: "TG5 task" }).click()

    const comments = drawer(page).locator('[data-testid="comment"]')
    await expect(comments).toHaveCount(2)
    await expect(comments.nth(0)).toContainText("TG5 old")
    await expect(comments.nth(1)).toContainText("TG5 new")
  })
})
