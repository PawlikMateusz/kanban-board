import { test, expect } from "@playwright/test"
import { cleanup, createProject, createTask, searchInput, wipeAllData } from "./helpers"

test.describe("TJ – search", () => {
  test.beforeEach(() => wipeAllData())
  test.afterAll(() => cleanup())

  test("TJ1 – search by title", async ({ page }) => {
    const project = await createProject("TJ Project")
    await createTask({ project: project.id, title: "TJ1 needle in haystack" })

    await page.goto("/")
    const input = searchInput(page)
    await input.fill("TJ1 needle")

    const results = page.locator('[data-testid="search-results"]')
    await expect(results).toBeVisible()
    await expect(results.getByText("TJ Project")).toBeVisible()
    await expect(results.getByText("TJ1 needle in haystack")).toBeVisible()
  })

  test("TJ2 – search by description", async ({ page }) => {
    const project = await createProject("TJ Project")
    await createTask({ project: project.id, title: "TJ2 unrelated title", description: "TJ2 unique phrase in body" })

    await page.goto("/")
    const input = searchInput(page)
    await input.fill("TJ2 unique phrase")

    const results = page.locator('[data-testid="search-results"]')
    await expect(results.getByText("TJ2 unrelated title")).toBeVisible()
  })

  test("TJ3 – no results", async ({ page }) => {
    const project = await createProject("TJ Project")
    await createTask({ project: project.id, title: "TJ3 something" })

    await page.goto("/")
    await searchInput(page).fill("zzqqxx")

    const results = page.locator('[data-testid="search-results"]')
    await expect(results.getByText("No results.")).toBeVisible()
  })

  test("TJ4 – debounce & min length", async ({ page }) => {
    const project = await createProject("TJ Project")
    await createTask({ project: project.id, title: "TJ4 matchable" })

    await page.goto("/")
    const input = searchInput(page)
    await input.fill("t")

    const results = page.locator('[data-testid="search-results"]')
    await expect(results.getByText("Type at least 2 characters…")).toBeVisible()
    await expect(results.getByText("TJ4 matchable")).toHaveCount(0)

    await input.fill("TJ4")
    await expect(results.getByText("TJ4 matchable")).toBeVisible()
  })

  test("TJ5 – open task from search", async ({ page }) => {
    const project = await createProject("TJ Project")
    await createTask({ project: project.id, title: "TJ5 opener" })

    await page.goto("/")
    const input = searchInput(page)
    await input.fill("TJ5 opener")

    const results = page.locator('[data-testid="search-results"]')
    await expect(results.getByText("TJ5 opener")).toBeVisible()
    await results.getByText("TJ5 opener").click()

    await expect(page.getByPlaceholder("Task title")).toHaveValue("TJ5 opener")
    await expect(input).toHaveValue("")
  })
})
