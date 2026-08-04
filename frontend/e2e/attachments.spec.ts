import { test, expect } from "@playwright/test"
import {
  cleanup,
  createProject,
  createTask,
  expandDashboardSection,
  getTask,
  uploadAttachment,
  utcDaysFromNow,
  wipeAllData,
} from "./helpers"

test.describe("TH – attachments", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  function drawer(page: import("@playwright/test").Page) {
    return page.locator('[data-testid="task-drawer"]')
  }

  async function openTask(page: import("@playwright/test").Page, title: string) {
    await expandDashboardSection(page, "today")
    await page.getByRole("button", { name: title }).first().click()
    await expect(page.getByPlaceholder("Add a comment…")).toBeVisible()
  }

  function upload(page: import("@playwright/test").Page, files: { name: string; mimeType: string; buffer: Buffer }[]) {
    return page.setInputFiles('input[type="file"]', files)
  }

  /** PocketBase renames uploaded files (notes.txt → notes_ab12cd.txt); returns
   *  the stored filename once the upload lands. */
  async function storedAttachment(taskId: string, prefix: string) {
    const t = await getTask(taskId)
    return t.attachments.find((a) => a.startsWith(prefix))
  }

  test("TH1 – upload attachment", async ({ page }) => {
    const project = await createProject("TH Project")
    const task = await createTask({ project: project.id, title: "TH1 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TH1 task")
    await expect(page.getByText("No attachments.")).toBeVisible()

    await upload(page, [{ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") }])

    await expect.poll(async () => (await getTask(task.id)).attachments.length).toBe(1)
    const name = await storedAttachment(task.id, "notes_")
    await expect(drawer(page).getByText(name!)).toBeVisible()
    await expect(drawer(page).locator('a[download]')).toBeVisible()
  })

  test("TH2 – download attachment", async ({ page }) => {
    const project = await createProject("TH Project")
    const task = await createTask({ project: project.id, title: "TH2 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TH2 task")
    await upload(page, [{ name: "download.txt", mimeType: "text/plain", buffer: Buffer.from("data") }])
    await expect.poll(async () => (await getTask(task.id)).attachments.length).toBe(1)
    const name = await storedAttachment(task.id, "download_")

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      drawer(page).getByText(name!).click(),
    ])
    expect(download.suggestedFilename()).toBe(name)
  })

  test("TH3 – remove attachment", async ({ page }) => {
    const project = await createProject("TH Project")
    const task = await createTask({ project: project.id, title: "TH3 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TH3 task")
    await upload(page, [{ name: "remove.txt", mimeType: "text/plain", buffer: Buffer.from("x") }])
    await expect.poll(async () => (await getTask(task.id)).attachments.length).toBe(1)
    const name = await storedAttachment(task.id, "remove_")
    await expect(drawer(page).getByText(name!)).toBeVisible()

    await drawer(page).getByRole("button", { name: "Remove attachment" }).click()

    await expect.poll(async () => (await getTask(task.id)).attachments.length).toBe(0)
    await expect(drawer(page).getByText(name!)).toBeHidden()
  })

  test("TH4 – multiple uploads", async ({ page }) => {
    const project = await createProject("TH Project")
    const task = await createTask({ project: project.id, title: "TH4 task", dueDate: utcDaysFromNow(0) })
    await page.goto("/")

    await openTask(page, "TH4 task")
    await upload(page, [
      { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("a") },
      { name: "b.txt", mimeType: "text/plain", buffer: Buffer.from("b") },
    ])

    await expect.poll(async () => (await getTask(task.id)).attachments.length).toBe(2)

    const card = page.locator('[data-testid="task-card"]', { hasText: "TH4 task" })
    await expect(card.locator('[data-testid="attachment-count"]')).toHaveText("2")
  })

  test("TH5 – card paperclip icon", async ({ page }) => {
    const project = await createProject("TH Project")
    const task = await createTask({ project: project.id, title: "TH5 task", dueDate: utcDaysFromNow(0) })
    await uploadAttachment(task.id, "file.txt")
    await page.goto("/")
    await expandDashboardSection(page, "today")

    const card = page.locator('[data-testid="task-card"]', { hasText: "TH5 task" })
    await expect(card.locator('[data-testid="attachment-count"]')).toHaveText("1")
  })
})
