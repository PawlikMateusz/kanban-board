import { test, expect } from "@playwright/test"
import { cleanup, column, columnCard, createProject, createTask, taskCard, wipeAllData } from "./helpers"

test.describe("TN – responsive / mobile", () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })

  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  test("TN1 – mobile layout", async ({ page }) => {
    const project = await createProject("TN1 Project")
    await createTask({ project: project.id, title: "TN1 task", status: "todo", order: 1 })

    await page.goto(`/projects/${project.id}`)

    // sidebar hidden, mobile header + project chip shown
    await expect(page.locator("aside").first()).toBeHidden()
    await expect(page.locator("header").first()).toBeVisible()
    await expect(page.locator("header").first().getByRole("link", { name: /TN1 Project/ })).toBeVisible()

    // board scrolls horizontally
    const scroll = await page
      .locator('[data-testid="board"]')
      .evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }))
    expect(scroll.sw).toBeGreaterThan(scroll.cw)
  })

  test("TN2 – mobile drawer as full-screen", async ({ page }) => {
    const project = await createProject("TN2 Project")
    await createTask({ project: project.id, title: "TN2 task", status: "todo", order: 1 })

    await page.goto(`/projects/${project.id}`)
    await taskCard(page, "TN2 task").click()

    const drawer = page.locator('[data-testid="task-drawer"]')
    await expect(drawer).toBeVisible()
    const box = await drawer.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(370)

    // Close button closes it
    await drawer.getByRole("button", { name: "Close" }).click()
    await expect(page.getByPlaceholder("Task title")).toBeHidden()
  })

  test("TN3 – touch drag", async ({ page }) => {
    const project = await createProject("TN3 Project")
    await createTask({ project: project.id, title: "TN3 touch", status: "todo", order: 1 })

    await page.goto(`/projects/${project.id}`)
    await expect(columnCard(page, "todo", "TN3 touch")).toBeVisible()

    const client = await page.context().newCDPSession(page)
    const source = page.locator('[data-testid="task-card"]', { hasText: "TN3 touch" })
    const target = page.locator('[data-testid="column-drop-doing"]')
    const sb = (await source.boundingBox())!
    const tb = (await target.boundingBox())!
    const from = { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 }
    // The board scrolls horizontally, so the doing column may be partly off-screen.
    // Pick a point inside the target rect that is also within the viewport.
    const to = {
      x: Math.min(Math.max(tb.x + 20, tb.x + tb.width / 2), 370),
      y: Math.max(tb.y + 10, sb.y + sb.height / 2),
    }

    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] })
    await page.waitForTimeout(250) // TouchSensor activation delay is 200ms
    const steps = 15
    for (let i = 1; i <= steps; i++) {
      const x = from.x + ((to.x - from.x) * i) / steps
      const y = from.y + ((to.y - from.y) * i) / steps
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] })
      await page.waitForTimeout(16)
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })

    await expect(columnCard(page, "doing", "TN3 touch")).toBeVisible()
  })
})
