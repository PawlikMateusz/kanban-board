import { test, expect } from "@playwright/test"
import {
  cleanup,
  column,
  createProject,
  createTask,
  dragCard,
  waitForProject,
  wipeAllData,
} from "./helpers"

test.describe("TM – persistence & reliability", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  test("TM1 – full page refresh keeps data", async ({ page }) => {
    const project = await createProject("TM1 Project")

    await page.goto("/")
    await waitForProject(page, "TM1 Project")
    await page.getByRole("button", { name: "New task" }).click()
    await page.getByPlaceholder("What needs to be done?").fill("TM1 survives")
    await page.getByPlaceholder("What needs to be done?").press("Enter")

    // QuickCreate tasks have no due date, so they open from the project board.
    await page.goto(`/projects/${project.id}`)
    await page.locator('[data-testid="task-card"]', { hasText: "TM1 survives" }).click()
    await page.getByPlaceholder("Add an item…").fill("TM1 checklist item")
    await page.getByPlaceholder("Add an item…").press("Enter")
    await page.getByPlaceholder("Add a comment…").fill("TM1 comment")
    await page.getByPlaceholder("Add a comment…").press("Enter")

    await expect(page.getByText("TM1 checklist item")).toBeVisible()
    await expect(page.getByText("TM1 comment")).toBeVisible()

    await page.reload()

    await page.locator('[data-testid="task-card"]', { hasText: "TM1 survives" }).click()
    await expect(page.getByText("TM1 checklist item")).toBeVisible()
    await expect(page.getByText("TM1 comment")).toBeVisible()
  })

  test("TM2 – optimistic update on drag", async ({ page }) => {
    const project = await createProject("TM2 Project")
    await createTask({ project: project.id, title: "TM2 drag", status: "todo", order: 1 })

    // Fail the move request ~1s after it fires so the optimistic state is visible.
    await page.route("**/api/collections/tasks/**", async (route) => {
      if (route.request().method() === "PATCH") {
        await new Promise((r) => setTimeout(r, 1000))
        await route.abort()
      } else {
        await route.fallback()
      }
    })

    await page.goto(`/projects/${project.id}`)
    await expect(column(page, "todo").locator('[data-testid="task-card"]', { hasText: "TM2 drag" })).toBeVisible()

    await dragCard(page, "TM2 drag", column(page, "doing").locator('[data-testid="column-drop-doing"]'))

    // optimistic: moved before the server confirms
    await expect(column(page, "doing").locator('[data-testid="task-card"]', { hasText: "TM2 drag" })).toBeVisible()

    // server rejects → state rolls back
    await expect(column(page, "todo").locator('[data-testid="task-card"]', { hasText: "TM2 drag" })).toBeVisible()
    await expect(column(page, "doing").locator('[data-testid="task-card"]', { hasText: "TM2 drag" })).toHaveCount(0)
  })

  test("TM3 – query error resilience", async ({ page }) => {
    const project = await createProject("TM3 Project")

    await page.route("**/api/collections/**", (route) => route.abort())
    await page.route("**/api/files/**", (route) => route.abort())
    await page.goto("/")

    // empty states, no white screen
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
    await expect(page.getByText("No projects yet.")).toBeVisible()
    await expect(page.getByText(/No tasks yet/)).toBeVisible()

    // restore backend → data loads on reload
    await page.unroute("**/api/collections/**")
    await page.unroute("**/api/files/**")
    await page.reload()
    await expect(page.getByRole("link", { name: /TM3 Project/ })).toBeVisible()
    await expect(page.getByText("No projects yet.")).toBeHidden()
  })

  test("TM4 – no console errors on happy path", async ({ page }) => {
    const project = await createProject("TM4 Project")
    const problems: string[] = []
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`))
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console: ${m.text()}`)
    })

    await page.goto("/")
    await waitForProject(page, "TM4 Project")
    await page.getByRole("button", { name: "New task" }).click()
    await page.getByPlaceholder("What needs to be done?").fill("TM4 flow")
    await page.getByPlaceholder("What needs to be done?").press("Enter")

    await page.goto(`/projects/${project.id}`)
    await page.locator('[data-testid="task-card"]', { hasText: "TM4 flow" }).click()
    await page.getByPlaceholder("Add an item…").fill("TM4 item")
    await page.getByPlaceholder("Add an item…").press("Enter")
    await page.getByPlaceholder("Add a comment…").fill("TM4 comment")
    await page.getByPlaceholder("Add a comment…").press("Enter")
    await expect(page.getByText("TM4 comment")).toBeVisible()

    await page.reload()
    await expect(page.locator('[data-testid="task-card"]', { hasText: "TM4 flow" })).toBeVisible()

    expect(problems).toEqual([])
  })
})
