import { test, expect } from "@playwright/test"
import {
  cleanup,
  column,
  columnCard,
  createProject,
  createTask,
  dragCard,
  dragCardTo,
  getTask,
  listTasks,
  wipeAllData,
} from "./helpers"

test.describe("TC – project board", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  async function seedBoard() {
    const project = await createProject("TC Project")
    await createTask({ project: project.id, title: "TC todo", status: "todo", order: 1 })
    await createTask({ project: project.id, title: "TC doing", status: "doing", order: 2 })
    await createTask({ project: project.id, title: "TC done", status: "done", order: 3 })
    return project
  }

  test("TC1 – board renders three columns", async ({ page }) => {
    const project = await seedBoard()
    await page.goto(`/projects/${project.id}`)

    for (const status of ["todo", "doing", "done"] as const) {
      await expect(column(page, status)).toBeVisible()
      await expect(column(page, status).locator(`[data-testid="column-count-${status}"]`)).toHaveText("1")
    }
    await expect(columnCard(page, "todo", "TC todo")).toBeVisible()
    await expect(columnCard(page, "doing", "TC doing")).toBeVisible()
    await expect(columnCard(page, "done", "TC done")).toBeVisible()
  })

  test("TC2 – add task per column", async ({ page }) => {
    const project = await createProject("TC Project")
    await createTask({ project: project.id, title: "TC existing", status: "todo", order: 1 })

    await page.goto(`/projects/${project.id}`)

    // via the column "+" button
    await page.getByRole("button", { name: "Add to Doing" }).click()
    await page.getByPlaceholder("What needs to be done?").fill("TC from plus")
    await page.getByPlaceholder("What needs to be done?").press("Enter")
    await expect(columnCard(page, "doing", "TC from plus")).toBeVisible()

    // via the empty-state "Add a task" button
    await column(page, "done").getByRole("button", { name: "Add a task" }).click()
    await page.getByPlaceholder("What needs to be done?").fill("TC from empty")
    await page.getByPlaceholder("What needs to be done?").press("Enter")
    await expect(columnCard(page, "done", "TC from empty")).toBeVisible()
  })

  test("TC3 – drag task to another column", async ({ page }) => {
    const project = await createProject("TC Project")
    await createTask({ project: project.id, title: "TC drag", status: "todo", order: 1 })

    await page.goto(`/projects/${project.id}`)
    await expect(columnCard(page, "todo", "TC drag")).toBeVisible()

    await dragCard(page, "TC drag", column(page, "doing").locator('[data-testid="column-drop-doing"]'))

    await expect(columnCard(page, "doing", "TC drag")).toBeVisible()
    await expect(columnCard(page, "todo", "TC drag")).toHaveCount(0)

    await page.reload()
    await expect(columnCard(page, "doing", "TC drag")).toBeVisible()
    expect((await getTask((await listTasks()).find((t) => t.title === "TC drag")!.id)).status).toBe("doing")
  })

  test("TC4 – reorder within a column", async ({ page }) => {
    const project = await createProject("TC Project")
    await createTask({ project: project.id, title: "TC reorder first", status: "todo", order: 1 })
    await createTask({ project: project.id, title: "TC reorder second", status: "todo", order: 2 })

    await page.goto(`/projects/${project.id}`)
    const cards = column(page, "todo").locator('[data-testid="task-card"]')
    await expect(cards).toHaveCount(2)
    await expect(cards.nth(0)).toContainText("TC reorder first")

    await dragCard(page, "TC reorder second", taskCardLocator(page, "TC reorder first"))

    await expect(cards.nth(0)).toContainText("TC reorder second")

    await page.reload()
    await expect(column(page, "todo").locator('[data-testid="task-card"]').nth(0)).toContainText(
      "TC reorder second"
    )
  })

  test("TC4b – reorder within a column: move top card below its sibling", async ({ page }) => {
    const project = await createProject("TC Project")
    await createTask({ project: project.id, title: "TC down first", status: "todo", order: 1 })
    await createTask({ project: project.id, title: "TC down second", status: "todo", order: 2 })

    await page.goto(`/projects/${project.id}`)
    const cards = column(page, "todo").locator('[data-testid="task-card"]')
    await expect(cards).toHaveCount(2)
    await expect(cards.nth(0)).toContainText("TC down first")

    // Drop the top card onto the lower half of the second card → it should land after it.
    const target = columnCard(page, "todo", "TC down second")
    const tb = await target.boundingBox()
    if (!tb) throw new Error("target card not visible")
    await dragCardTo(page, "TC down first", tb.x + tb.width / 2, tb.y + tb.height * 0.75)

    await expect(cards.nth(0)).toContainText("TC down second")
    await expect(cards.nth(1)).toContainText("TC down first")

    await page.reload()
    const after = column(page, "todo").locator('[data-testid="task-card"]')
    await expect(after.nth(0)).toContainText("TC down second")
    await expect(after.nth(1)).toContainText("TC down first")

    // Persisted orders reflect the new order.
    const tasks = await listTasks()
    const first = tasks.find((t) => t.title === "TC down first")!
    const second = tasks.find((t) => t.title === "TC down second")!
    expect(second.order).toBeLessThan(first.order)
  })

  test("TC4c – reorder within a column: insert a card into the middle", async ({ page }) => {
    const project = await createProject("TC Project")
    await createTask({ project: project.id, title: "TC mid A", status: "todo", order: 1 })
    await createTask({ project: project.id, title: "TC mid B", status: "todo", order: 2 })
    await createTask({ project: project.id, title: "TC mid C", status: "todo", order: 3 })

    await page.goto(`/projects/${project.id}`)
    const cards = column(page, "todo").locator('[data-testid="task-card"]')
    await expect(cards).toHaveCount(3)
    await expect(cards.nth(0)).toContainText("TC mid A")

    // Drag A below B (lower half of B) → A should land between B and C.
    const b = columnCard(page, "todo", "TC mid B")
    const bb = await b.boundingBox()
    if (!bb) throw new Error("target card not visible")
    await dragCardTo(page, "TC mid A", bb.x + bb.width / 2, bb.y + bb.height * 0.75)

    const expected = ["TC mid B", "TC mid A", "TC mid C"]
    for (let i = 0; i < expected.length; i++) {
      await expect(cards.nth(i)).toContainText(expected[i])
    }

    await page.reload()
    const after = column(page, "todo").locator('[data-testid="task-card"]')
    for (let i = 0; i < expected.length; i++) {
      await expect(after.nth(i)).toContainText(expected[i])
    }
  })

  test("TC4d – cards reorder live while dragging (no need to hold/drop)", async ({ page }) => {
    const project = await createProject("TC Project")
    await createTask({ project: project.id, title: "TC live A", status: "todo", order: 1 })
    await createTask({ project: project.id, title: "TC live B", status: "todo", order: 2 })
    await createTask({ project: project.id, title: "TC live C", status: "todo", order: 3 })

    await page.goto(`/projects/${project.id}`)
    const cards = column(page, "todo").locator('[data-testid="task-card"]')
    await expect(cards).toHaveCount(3)

    // Drag A down into the lower half of B and HOLD (mouse still down).
    const source = columnCard(page, "todo", "TC live A")
    const sb = await source.boundingBox()
    if (!sb) throw new Error("source card not visible")
    const b = columnCard(page, "todo", "TC live B")
    const bb = await b.boundingBox()
    if (!bb) throw new Error("target card not visible")
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
    await page.mouse.down()
    await page.mouse.move(sb.x + sb.width / 2 + 10, sb.y + sb.height / 2 + 5, { steps: 4 })
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height * 0.75, { steps: 30 })
    await page.waitForTimeout(200)

    // The column must already be reordered while the drag is still held.
    await expect(cards.nth(0)).toContainText("TC live B")
    await expect(cards.nth(1)).toContainText("TC live A")

    await page.mouse.up()

    await expect(cards.nth(0)).toContainText("TC live B")
    await expect(cards.nth(1)).toContainText("TC live A")

    await page.reload()
    const after = column(page, "todo").locator('[data-testid="task-card"]')
    await expect(after.nth(0)).toContainText("TC live B")
    await expect(after.nth(1)).toContainText("TC live A")
    await expect(after.nth(2)).toContainText("TC live C")
  })

  test("TC5 – drag to empty column", async ({ page }) => {
    const project = await createProject("TC Project")
    await createTask({ project: project.id, title: "TC to empty", status: "todo", order: 1 })

    await page.goto(`/projects/${project.id}`)
    await expect(column(page, "done").locator('[data-testid="column-drop-done"]')).toBeVisible()

    await dragCard(page, "TC to empty", column(page, "done").locator('[data-testid="column-drop-done"]'))

    await expect(columnCard(page, "done", "TC to empty")).toBeVisible()
    await expect(column(page, "done").locator('[data-testid="column-count-done"]')).toHaveText("1")
    await expect(column(page, "todo").locator('[data-testid="column-count-todo"]')).toHaveText("0")
  })

  test("TC6 – board only shows that project's tasks", async ({ page }) => {
    const projectA = await createProject("TC Project A")
    const projectB = await createProject("TC Project B")
    await createTask({ project: projectA.id, title: "TC in A", status: "todo", order: 1 })
    await createTask({ project: projectB.id, title: "TC in B", status: "todo", order: 1 })

    await page.goto(`/projects/${projectA.id}`)

    await expect(columnCard(page, "todo", "TC in A")).toBeVisible()
    await expect(columnCard(page, "todo", "TC in B")).toHaveCount(0)
  })
})

function taskCardLocator(page: import("@playwright/test").Page, title: string) {
  return page.locator('[data-testid="task-card"]', { hasText: title }).first()
}
