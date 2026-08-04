import { test, expect } from "@playwright/test"
import {
  cleanup,
  createProject,
  createTask,
  dashboardSection,
  dragHandleTo,
  utcDaysFromNow,
  wipeAllData,
} from "./helpers"

test.describe("Q – no-due queue", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  const queueTitles = async (page: import("@playwright/test").Page) => {
    const cards = dashboardSection(page, "queue").locator('[data-testid="task-card"]')
    return (await cards.allTextContents()).map((t) => t.trim())
  }

  test("Q1 – no-due task can be added to the queue from the drawer", async ({ page }) => {
    const inbox = await createProject("Q1 Project")
    await createTask({ project: inbox.id, title: "Q1 card" })

    await page.goto("/")
    await page.locator("aside").getByRole("link", { name: "Q1 Project" }).click()
    await page.getByRole("button", { name: "Q1 card" }).click()

    const addBtn = page.locator('[data-testid="drawer-add-queue"]')
    await expect(addBtn).toBeVisible()
    await expect(addBtn).toBeEnabled()
    await addBtn.click()

    await page.goto("/")
    const queue = dashboardSection(page, "queue")
    await expect(queue).toBeVisible()
    await expect(queue.getByRole("button", { name: "Q1 card" })).toBeVisible()
    await expect(page.locator('[data-testid="section-count-queue"]')).toHaveText("1")
  })

  test("Q2 – task with a due date cannot be added to the queue", async ({ page }) => {
    const inbox = await createProject("Q2 Project")
    await createTask({ project: inbox.id, title: "Q2 scheduled", dueDate: utcDaysFromNow(2) })

    await page.goto("/")
    await page.locator("aside").getByRole("link", { name: "Q2 Project" }).click()
    await page.getByRole("button", { name: "Q2 scheduled" }).click()

    await expect(page.locator('[data-testid="drawer-add-queue"]')).toBeDisabled()
    await expect(dashboardSection(page, "queue").locator('[data-testid="task-card"]')).toHaveCount(0)
  })

  test("Q3 – task can be removed from the queue", async ({ page }) => {
    const inbox = await createProject("Q3 Project")
    await createTask({ project: inbox.id, title: "Q3 queued", queued: true, queueOrder: 1024 })

    await page.goto("/")
    const queue = dashboardSection(page, "queue")
    await expect(queue.getByRole("button", { name: "Q3 queued" })).toBeVisible()

    await queue.getByRole("button", { name: "Q3 queued" }).click()
    await expect(page.locator('[data-testid="drawer-remove-queue"]')).toBeVisible()
    await page.locator('[data-testid="drawer-remove-queue"]').click()

    await expect(queue.locator('[data-testid="task-card"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="section-count-queue"]')).toHaveText("0")
  })

  test("Q4 – queue cards can be reordered by dragging", async ({ page }) => {
    const inbox = await createProject("Q4 Project")
    await createTask({ project: inbox.id, title: "Q4 first", queued: true, queueOrder: 1024 })
    await createTask({ project: inbox.id, title: "Q4 second", queued: true, queueOrder: 2048 })

    await page.goto("/")
    const queue = dashboardSection(page, "queue")
    await expect(queue.locator('[data-testid="task-card"]')).toHaveCount(2)
    expect((await queueTitles(page))[0]).toContain("Q4 first")
    expect((await queueTitles(page))[1]).toContain("Q4 second")

    const firstHandle = queue.locator('[data-testid="queue-handle"]').nth(0)
    const secondHandle = queue.locator('[data-testid="queue-handle"]').nth(1)
    await dragHandleTo(page, firstHandle, secondHandle)

    await expect.poll(() => queueTitles(page)).toEqual(["Q4 second", "Q4 first"])
  })
})
