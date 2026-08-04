import { test, expect } from "@playwright/test"
import {
  cleanup,
  createChecklistItem,
  createComment,
  createProject,
  createTask,
  dashboardSection,
  dashboardSectionCount,
  expandDashboardSection,
  uploadAttachment,
  utcDaysFromNow,
  wipeAllData,
} from "./helpers"

test.describe("TB – dashboard timeline", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  test("TB4 – empty section is omitted", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText(/No tasks yet/)).toBeVisible()
    await expect(dashboardSection(page, "overdue")).toHaveCount(0)
    await expect(dashboardSectionCount(page, "overdue")).toHaveCount(0)
  })

  test("TB1 – dashboard renders all sections", async ({ page }) => {
    const inbox = await createProject("TB1 Project")
    await createTask({ project: inbox.id, title: "TB1 overdue", dueDate: utcDaysFromNow(-1) })
    await createTask({ project: inbox.id, title: "TB1 today", dueDate: utcDaysFromNow(0) })
    await createTask({ project: inbox.id, title: "TB1 next3", dueDate: utcDaysFromNow(2) })
    await createTask({ project: inbox.id, title: "TB1 next7", dueDate: utcDaysFromNow(5) })
    await createTask({ project: inbox.id, title: "TB1 next14", dueDate: utcDaysFromNow(10) })
    await createTask({ project: inbox.id, title: "TB1 next30", dueDate: utcDaysFromNow(20) })
    await createTask({ project: inbox.id, title: "TB1 none" })

    await page.goto("/")
    const keys = ["overdue", "today", "next3", "next7", "next14", "next30"]
    for (const key of keys) {
      await expect(dashboardSection(page, key)).toBeVisible()
    }
    await expect(page.getByText("7 tasks across all projects")).toBeVisible()
  })

  test("TB2 – tasks appear in the correct section", async ({ page }) => {
    const inbox = await createProject("TB2 Project")
    await createTask({ project: inbox.id, title: "TB2 overdue", dueDate: utcDaysFromNow(-1) })
    await createTask({ project: inbox.id, title: "TB2 today", dueDate: utcDaysFromNow(0) })
    await createTask({ project: inbox.id, title: "TB2 three", dueDate: utcDaysFromNow(2) })
    await createTask({ project: inbox.id, title: "TB2 seven", dueDate: utcDaysFromNow(5) })
    await createTask({ project: inbox.id, title: "TB2 fourteen", dueDate: utcDaysFromNow(10) })
    await createTask({ project: inbox.id, title: "TB2 thirty", dueDate: utcDaysFromNow(20) })
    await createTask({ project: inbox.id, title: "TB2 none" })

    await page.goto("/")

    const expected: [string, string][] = [
      ["overdue", "TB2 overdue"],
      ["today", "TB2 today"],
      ["next3", "TB2 three"],
      ["next7", "TB2 seven"],
      ["next14", "TB2 fourteen"],
      ["next30", "TB2 thirty"],
    ]
    for (const [key, title] of expected) {
      await expect(dashboardSection(page, key).getByRole("button", { name: title })).toBeVisible()
    }
    // Each lands in exactly one bucket: no cross-bucket leakage.
    for (const [key, title] of expected) {
      for (const other of expected.filter(([k]) => k !== key)) {
        await expect(
          dashboardSection(page, other[0]).getByRole("button", { name: title })
        ).toHaveCount(0)
      }
    }
  })

  test("TB3 – timeline visual structure", async ({ page }) => {
    const inbox = await createProject("TB3 Project")
    for (const name of ["TB3 first", "TB3 second", "TB3 third"]) {
      await createTask({ project: inbox.id, title: name, dueDate: utcDaysFromNow(2) })
    }

    await page.goto("/")

    const section = dashboardSection(page, "next3")
    await expect(section.locator('[data-testid="task-card"]')).toHaveCount(3)
    await expect(section.locator('[data-testid="timeline-dot"]')).toHaveCount(3)
    await expect(section.locator('[data-testid="timeline-connector"]')).toHaveCount(2)
  })

  test("TB5 – open drawer from dashboard", async ({ page }) => {
    const inbox = await createProject("TB5 Project")
    await createTask({ project: inbox.id, title: "TB5 task", dueDate: utcDaysFromNow(0) })

    await page.goto("/")
    await expandDashboardSection(page, "today")
    await page.getByRole("button", { name: "TB5 task" }).click()

    await expect(page.locator('[data-testid="task-drawer"]')).toBeVisible()
    await expect(page.getByPlaceholder("Task title")).toHaveValue("TB5 task")
    await expect(page).toHaveURL(/\/$/)
  })

  test("TB6 – card meta indicators", async ({ page }) => {
    const inbox = await createProject("TB6 Project")
    const task = await createTask({ project: inbox.id, title: "TB6 meta", dueDate: utcDaysFromNow(0) })
    await createChecklistItem(task.id, "item", false, 1)
    await createComment(task.id, "hello")
    await uploadAttachment(task.id, "file.txt")

    await page.goto("/")
    await expandDashboardSection(page, "today")

    const card = page.locator('[data-testid="task-card"]', { hasText: "TB6 meta" })
    await expect(card.locator('[data-testid="checklist-progress"]')).toHaveText("0/1")
    await expect(card.locator('[data-testid="comment-count"]')).toHaveText("1")
    await expect(card.locator('[data-testid="attachment-count"]')).toHaveText("1")
  })

  test("TB7 – card shows project name", async ({ page }) => {
    const inbox = await createProject("TB7 Project", "#22c55e")
    await createTask({ project: inbox.id, title: "TB7 task", dueDate: utcDaysFromNow(0) })

    await page.goto("/")
    await expandDashboardSection(page, "today")

    const card = page.locator('[data-testid="task-card"]', { hasText: "TB7 task" })
    await expect(card).toContainText("TB7 Project")
  })

  test("TB8 – in-progress tasks appear only via their due date; no In Progress section", async ({
    page,
  }) => {
    const inbox = await createProject("TB8 Project")
    await createTask({ project: inbox.id, title: "TB8 doing nodate", status: "doing" })
    await createTask({
      project: inbox.id,
      title: "TB8 doing today",
      status: "doing",
      dueDate: utcDaysFromNow(0),
    })
    await createTask({ project: inbox.id, title: "TB8 todo today", dueDate: utcDaysFromNow(0) })

    await page.goto("/")

    // There is no In Progress section anymore.
    await expect(dashboardSection(page, "inprogress")).toHaveCount(0)

    // A doing task without a due date is not shown on the dashboard at all.
    await expect(page.getByRole("button", { name: "TB8 doing nodate", exact: true })).toHaveCount(0)

    // A doing task with a due date appears in its date section alongside others.
    const today = dashboardSection(page, "today")
    await expect(today.getByRole("button", { name: "TB8 doing today" })).toBeVisible()
    await expect(today.getByRole("button", { name: "TB8 todo today" })).toBeVisible()
  })

  test("TB9 – mini calendar highlights today and dots due-date days", async ({ page }) => {
    const inbox = await createProject("TB9 Project")
    await createTask({ project: inbox.id, title: "TB9 today", dueDate: utcDaysFromNow(0) })
    await createTask({ project: inbox.id, title: "TB9 in2", dueDate: utcDaysFromNow(2) })

    await page.goto("/")

    const cal = page.locator('[data-testid="mini-calendar"]')
    await expect(cal).toBeVisible()

    const now = new Date()
    const iso = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate()
      ).padStart(2, "0")}`

    // The calendar opens on the current month; navigate to any target month.
    const gotoMonth = async (d: Date) => {
      const cur = new Date()
      const diff =
        (d.getUTCFullYear() - cur.getUTCFullYear()) * 12 + (d.getUTCMonth() - cur.getUTCMonth())
      const btn =
        diff > 0
          ? cal.locator('[data-testid="cal-next-month"]')
          : cal.locator('[data-testid="cal-prev-month"]')
      for (let i = 0; i < Math.abs(diff); i++) await btn.click()
    }

    // Today is highlighted and dotted for the due-today task.
    const todayCell = cal.locator(`[data-testid="cal-day-${iso(now)}"]`)
    await expect(todayCell).toHaveClass(/bg-primary/)
    await expect(todayCell.locator("span.rounded-full")).toHaveCount(1)

    // A day with a task due in 2 days carries a dot.
    const in2 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2))
    await gotoMonth(in2)
    await expect(
      cal.locator(`[data-testid="cal-day-${iso(in2)}"]`).locator("span.rounded-full")
    ).toHaveCount(1)

    // A plain day (no tasks) has no dot.
    const plain = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 5))
    await gotoMonth(plain)
    await expect(
      cal.locator(`[data-testid="cal-day-${iso(plain)}"]`).locator("span.rounded-full")
    ).toHaveCount(0)
  })

  test("TB10 – hovering a calendar day dims non-matching timeline rows", async ({ page }) => {
    const inbox = await createProject("TB10 Project")
    await createTask({ project: inbox.id, title: "TB10 today", dueDate: utcDaysFromNow(0) })
    await createTask({ project: inbox.id, title: "TB10 in2", dueDate: utcDaysFromNow(2) })

    await page.goto("/")

    const cal = page.locator('[data-testid="mini-calendar"]')
    await expect(cal).toBeVisible()

    const now = new Date()
    const iso = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate()
      ).padStart(2, "0")}`

    // Navigate the calendar to the month of the given day (starts on current month).
    const gotoMonth = async (d: Date) => {
      const cur = new Date()
      const diff =
        (d.getUTCFullYear() - cur.getUTCFullYear()) * 12 + (d.getUTCMonth() - cur.getUTCMonth())
      const btn =
        diff > 0
          ? cal.locator('[data-testid="cal-next-month"]')
          : cal.locator('[data-testid="cal-prev-month"]')
      for (let i = 0; i < Math.abs(diff); i++) await btn.click()
    }

    const todayRow = dashboardSection(page, "today").getByRole("button", { name: "TB10 today" })
    const in2Row = dashboardSection(page, "next3").getByRole("button", { name: "TB10 in2" })
    const todayHeader = page.locator('[data-testid="section-header-today"]')
    const in2Header = page.locator('[data-testid="section-header-next3"]')
    await expect(todayRow).toBeVisible()
    await expect(in2Row).toBeVisible()
    await expect(todayRow.locator("..")).not.toHaveClass(/opacity-40/)
    await expect(in2Row.locator("..")).not.toHaveClass(/opacity-40/)
    await expect(todayHeader).not.toHaveClass(/opacity-40/)
    await expect(in2Header).not.toHaveClass(/opacity-40/)

    // Hover the "today" cell: the matching row + header stay full, the others dim.
    await gotoMonth(now)
    await cal.locator(`[data-testid="cal-day-${iso(now)}"]`).hover()
    await expect(todayRow.locator("..")).not.toHaveClass(/opacity-40/)
    await expect(in2Row.locator("..")).toHaveClass(/opacity-40/)
    await expect(todayHeader).not.toHaveClass(/opacity-40/)
    await expect(in2Header).toHaveClass(/opacity-40/)

    // Leaving the calendar clears the highlight.
    await page.mouse.move(0, 0)
    await expect(in2Row.locator("..")).not.toHaveClass(/opacity-40/)
    await expect(in2Header).not.toHaveClass(/opacity-40/)

    // Hovering a plain (no-task) day dims every visible row and header.
    const plain = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 5))
    await gotoMonth(plain)
    await cal.locator(`[data-testid="cal-day-${iso(plain)}"]`).hover()
    await expect(todayRow.locator("..")).toHaveClass(/opacity-40/)
    await expect(in2Row.locator("..")).toHaveClass(/opacity-40/)
    await expect(todayHeader).toHaveClass(/opacity-40/)
    await expect(in2Header).toHaveClass(/opacity-40/)
  })
})
