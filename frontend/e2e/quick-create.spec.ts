import { test, expect } from "@playwright/test"
import {
  cleanup,
  column,
  createLabel,
  createProject,
  dashboardSection,
  expandDashboardSection,
  listLabels,
  listTasks,
  pickSelectOption,
  waitForProject,
  wipeAllData,
} from "./helpers"

test.describe("TD – task creation (QuickCreate)", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  async function openCreate(page: import("@playwright/test").Page, projectName?: string) {
    if (projectName) await waitForProject(page, projectName)
    await page.getByRole("button", { name: "New task" }).first().click()
    await expect(page.getByPlaceholder("What needs to be done?")).toBeVisible()
  }

test("TD1 – create task from dashboard", async ({ page }) => {
    const project = await createProject("TD Project")
    await page.goto("/")

    await openCreate(page, "TD Project")
    const input = page.getByPlaceholder("What needs to be done?")
    await expect(input).toBeFocused()
    await input.fill("TD1 from dashboard")
    await input.press("Enter")

    // The task is created; with no due date it lives on its project board.
    await expect
      .poll(async () => (await listTasks()).some((t) => t.title === "TD1 from dashboard"))
      .toBe(true)
    await page.goto(`/projects/${project.id}`)
    await expect(
      column(page, "todo").locator('[data-testid="task-card"]', { hasText: "TD1 from dashboard" })
    ).toBeVisible()
  })

  test("TD2 – create task from project board", async ({ page }) => {
    const project = await createProject("TD Project")
    await page.goto(`/projects/${project.id}`)

    await openCreate(page, "TD Project")
    await expect(page.locator('[data-testid="qc-project"]')).toContainText("TD Project")
    await page.getByPlaceholder("What needs to be done?").fill("TD2 on board")
    await page.getByPlaceholder("What needs to be done?").press("Enter")

    await expect(
      column(page, "todo").locator('[data-testid="task-card"]', { hasText: "TD2 on board" })
    ).toBeVisible()
    const tasks = await listTasks()
    const task = tasks.find((t) => t.title === "TD2 on board")
    expect(task?.project).toBe(project.id)
  })

  test("TD3 – change project & status before save", async ({ page }) => {
    const projectA = await createProject("TD Project A")
    const projectB = await createProject("TD Project B")
    await page.goto("/")

    await openCreate(page, "TD Project A")
    await page.locator('[data-testid="qc-project"]').click()
    await pickSelectOption(page, "TD Project B")
    await page.locator('[data-testid="qc-status"]').click()
    await pickSelectOption(page, "Doing")
    await page.getByPlaceholder("What needs to be done?").fill("TD3 switched")
    await page.getByPlaceholder("What needs to be done?").press("Enter")

    const tasks = await listTasks()
    const task = tasks.find((t) => t.title === "TD3 switched")
    expect(task?.project).toBe(projectB.id)
    expect(task?.status).toBe("doing")
    expect(task?.project).not.toBe(projectA.id)
  })

  test("TD4 – cancel (Esc) deletes empty task", async ({ page }) => {
    const project = await createProject("TD Project")
    await page.goto("/")

    await openCreate(page, "TD Project")
    await page.keyboard.press("Escape")

    await expect(page.getByPlaceholder("What needs to be done?")).toBeHidden()
    await expect
      .poll(async () => (await listTasks()).filter((t) => t.project === project.id && !t.title.trim()).length)
      .toBe(0)
  })

  test("TD5 – Enter with empty title is a no-op / cancel", async ({ page }) => {
    const project = await createProject("TD Project")
    await page.goto("/")

    await openCreate(page, "TD Project")
    await page.getByPlaceholder("What needs to be done?").press("Enter")

    await expect
      .poll(async () => (await listTasks()).filter((t) => t.project === project.id && !t.title.trim()).length)
      .toBe(0)
    expect((await listTasks()).filter((t) => t.project === project.id)).toHaveLength(0)
  })

  test("TD6 – keyboard shortcut N", async ({ page }) => {
    const project = await createProject("TD Project")
    await page.goto("/")
    await waitForProject(page, "TD Project")

    await page.keyboard.press("n")
    await expect(page.getByPlaceholder("What needs to be done?")).toBeVisible()
    await page.keyboard.press("Escape")

    // inside an input, N does nothing
    await page.locator("aside").getByPlaceholder("Search tasks…").focus()
    await page.keyboard.press("n")
    await expect(page.getByPlaceholder("What needs to be done?")).toBeHidden()
    await page.locator("aside").getByPlaceholder("Search tasks…").fill("")

    // works on a project board too
    await page.goto(`/projects/${project.id}`)
    await waitForProject(page, "TD Project")
    await page.keyboard.press("n")
    await expect(page.getByPlaceholder("What needs to be done?")).toBeVisible()
  })

  test("TD7 – dynamic label creation", async ({ page }) => {
    const project = await createProject("TD Project")
    await page.goto("/")

    await openCreate(page, "TD Project")
    await page.getByPlaceholder("New label name…").fill("TD7 fresh label")
    await page.getByRole("button", { name: "Add" }).click()

    await expect(page.getByRole("button", { name: "TD7 fresh label" })).toBeVisible()
    await page.getByPlaceholder("What needs to be done?").fill("TD7 with label")
    await page.getByPlaceholder("What needs to be done?").press("Enter")

    const labels = await listLabels()
    const label = labels.find((l) => l.name === "TD7 fresh label")
    expect(label).toBeTruthy()
    const task = (await listTasks()).find((t) => t.title === "TD7 with label")
    expect(task?.labels).toEqual([label!.id])

    // With no due date the task lives on its project board, labels visible.
    await page.goto(`/projects/${project.id}`)
    await expect(
      column(page, "todo").locator('[data-testid="task-card"]', { hasText: "TD7 with label" })
    ).toContainText("TD7 fresh label")
  })

  test("TD8 – label de-duplication", async ({ page }) => {
    await createProject("TD Project")
    const existing = await createLabel("Existing", "#ef4444")
    await page.goto("/")

    await openCreate(page, "TD Project")
    await page.getByPlaceholder("New label name…").fill("existing")
    await page.getByRole("button", { name: "Add" }).click()
    await page.getByPlaceholder("What needs to be done?").fill("TD8 dedup")
    await page.getByPlaceholder("What needs to be done?").press("Enter")

    const labels = await listLabels()
    expect(labels.filter((l) => l.name.toLowerCase() === "existing")).toHaveLength(1)
    const task = (await listTasks()).find((t) => t.title === "TD8 dedup")
    expect(task?.labels).toEqual([existing.id])
  })

  test("TD9 – toggle existing labels", async ({ page }) => {
    await createProject("TD Project")
    const labelA = await createLabel("TD9 label A")
    const labelB = await createLabel("TD9 label B")
    await page.goto("/")

    await openCreate(page, "TD Project")
    await page.getByRole("button", { name: "TD9 label A" }).click()
    await page.getByRole("button", { name: "TD9 label B" }).click()
    await page.getByRole("button", { name: "TD9 label A" }).click() // deselect A

    await page.getByPlaceholder("What needs to be done?").fill("TD9 toggled")
    await page.getByPlaceholder("What needs to be done?").press("Enter")

    const task = (await listTasks()).find((t) => t.title === "TD9 toggled")
    expect(task?.labels).toEqual([labelB.id])
  })

  test("TD10 – abandoning QuickCreate leaves no orphan task", async ({ page }) => {
    const project = await createProject("TD Project")
    await createLabel("TD10 label")
    await page.goto("/")
    await waitForProject(page, "TD Project")

    // First quick-create: empty task created in the DB.
    await page.keyboard.press("n")
    await expect(page.getByPlaceholder("What needs to be done?")).toBeVisible()

    // Move focus off the input (click a label chip) and open a second
    // QuickCreate with the N shortcut — the first empty task must be cleaned up.
    await page.getByRole("button", { name: "TD10 label" }).click()
    await page.keyboard.press("n")
    await expect(page.getByPlaceholder("What needs to be done?")).toBeVisible()

    await page.getByPlaceholder("What needs to be done?").fill("TD10 final")
    await page.getByPlaceholder("What needs to be done?").press("Enter")

    await expect.poll(async () => (await listTasks()).filter((t) => t.project === project.id).length).toBe(1)
    const tasks = (await listTasks()).filter((t) => t.project === project.id)
    expect(tasks[0]?.title).toBe("TD10 final")
    expect(tasks.filter((t) => !t.title.trim()).length).toBe(0)
  })

  test("TD11 – due date set in QuickCreate persists and places the task in a dashboard section", async ({
    page,
  }) => {
    const project = await createProject("TD Project")
    await page.goto("/")

    await openCreate(page, "TD Project")

    // Pick a due date two days from now through the date-time picker.
    await page.locator('[data-testid="due-date-trigger"]').click()
    const now = new Date()
    const target = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2)
    )
    const diff =
      (target.getUTCFullYear() - now.getUTCFullYear()) * 12 +
      (target.getUTCMonth() - now.getUTCMonth())
    const nav =
      diff > 0
        ? page.locator('[data-testid="dp-next-month"]')
        : page.locator('[data-testid="dp-prev-month"]')
    for (let i = 0; i < Math.abs(diff); i++) await nav.click()
    const iso = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`
    await page.locator(`[data-testid="dp-day-${iso}"]`).click()

    await page.getByPlaceholder("What needs to be done?").fill("TD11 with due date")
    await page.getByPlaceholder("What needs to be done?").press("Enter")

    // The due date is persisted on the task.
    const task = (await listTasks()).find((t) => t.title === "TD11 with due date")
    expect(task).toBeTruthy()
    expect(task?.dueDate.startsWith(iso)).toBe(true)

    // The task lands in the matching dashboard section ("Next 3 days").
    await page.goto("/")
    await expandDashboardSection(page, "next3")
    await expect(
      dashboardSection(page, "next3").getByRole("button", { name: "TD11 with due date" })
    ).toBeVisible()
  })
})
