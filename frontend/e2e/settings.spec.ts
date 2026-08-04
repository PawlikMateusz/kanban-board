import { test, expect } from "@playwright/test"
import { cleanup, createComment, createProject, createTask, listComments, listProjects, listTasks, wipeAllData } from "./helpers"

test.describe("TK – settings", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  function projectSection(page: import("@playwright/test").Page) {
    return page.locator("section").filter({ has: page.getByRole("heading", { name: "Projects" }) })
  }

  function projectRow(page: import("@playwright/test").Page, name: string) {
    return page
      .locator("div.flex.items-center.gap-2")
      .filter({ has: page.locator(`input[value="${name}"]`) })
      .first()
  }

  test("TK1 – create project", async ({ page }) => {
    await page.goto("/settings")

    const section = projectSection(page)
    await section.getByPlaceholder("Project name").fill("TK1 project")
    await section.getByRole("button", { name: "Pick color" }).click()
    await page.getByRole("button", { name: "#0ea5e9" }).click()
    await section.getByRole("button", { name: "Add" }).click()

    await expect(section.locator('input[value="TK1 project"]')).toBeVisible()
    await expect(page.getByRole("link", { name: /TK1 project/ })).toBeVisible()

    const projects = await listProjects()
    const project = projects.find((p) => p.name === "TK1 project")
    expect(project?.color).toBe("#0ea5e9")
  })

  test("TK2 – rename project (blur)", async ({ page }) => {
    await createProject("TK2 old")
    await page.goto("/settings")

    const row = projectRow(page, "TK2 old")
    const input = row.locator("input")
    await input.fill("TK2 new")
    await input.blur()

    await expect.poll(async () => (await listProjects()).find((p) => p.name === "TK2 new")).toBeTruthy()
  })

  test("TK3 – delete project", async ({ page }) => {
    const project = await createProject("TK3 project")
    const task = await createTask({ project: project.id, title: "TK3 task" })
    await createComment(task.id, "TK3 comment")
    await page.goto("/settings")

    await projectRow(page, "TK3 project").getByRole("button", { name: "Delete project" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()

    // cancel keeps it
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(projectRow(page, "TK3 project")).toBeVisible()

    // confirm deletes project + tasks + comments
    await projectRow(page, "TK3 project").getByRole("button", { name: "Delete project" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "Delete" }).click()

    await expect(projectRow(page, "TK3 project")).toHaveCount(0)
    await expect.poll(async () => (await listProjects()).find((p) => p.name === "TK3 project")).toBeFalsy()
    await expect.poll(async () => (await listTasks()).filter((t) => t.project === project.id)).toHaveLength(0)
    await expect.poll(async () => (await listComments(task.id)).length).toBe(0)
  })

  test("TK4 – duplicate project name is allowed", async ({ page }) => {
    await page.goto("/settings")

    const section = projectSection(page)
    const add = async () => {
      await section.getByPlaceholder("Project name").fill("TK4 dup")
      await section.getByRole("button", { name: "Add" }).click()
    }
    await add()
    await add()

    await expect
      .poll(async () => (await listProjects()).filter((p) => p.name === "TK4 dup").length)
      .toBe(2)
  })

  test("TK5 – colour picker presets & free input", async ({ page }) => {
    await page.goto("/settings")

    const section = projectSection(page)
    await section.getByPlaceholder("Project name").fill("TK5 project")
    await section.getByRole("button", { name: "Pick color" }).click()
    await page.getByRole("button", { name: "#22c55e" }).click()
    await section.getByRole("button", { name: "Add" }).click()

    await expect
      .poll(async () => (await listProjects()).find((p) => p.name === "TK5 project")?.color)
      .toBe("#22c55e")

    // free hex input
    await projectRow(page, "TK5 project").getByRole("button", { name: "Pick color" }).click()
    await page.locator('[data-state="open"]').getByPlaceholder("#6366f1").fill("#123456")

    await expect
      .poll(async () => (await listProjects()).find((p) => p.name === "TK5 project")?.color)
      .toBe("#123456")
  })
})
