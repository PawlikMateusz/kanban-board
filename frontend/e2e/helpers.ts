import { expect, type Locator, type Page } from "@playwright/test"
import PocketBase from "pocketbase"

// The isolated test PocketBase instance (started by scripts/e2e.sh).
export const PB_URL = process.env.PB_TEST_URL || "http://localhost:8091"
export const pb = new PocketBase(PB_URL)

export type TaskStatus = "todo" | "doing" | "done"

export interface Project {
  id: string
  name: string
  color: string
  created: string
  updated: string
}
export interface Label {
  id: string
  name: string
  color: string
  created: string
  updated: string
}
export interface Task {
  id: string
  project: string
  title: string
  description: string
  status: TaskStatus
  dueDate: string
  order: number
  labels: string[]
  attachments: string[]
  created: string
  updated: string
}
export interface Comment {
  id: string
  task: string
  text: string
  created: string
  updated: string
}
export interface ChecklistItem {
  id: string
  task: string
  text: string
  checked: boolean
  order: number
  created: string
  updated: string
}

// ---------------------------------------------------------------------------
// Tracked records (for idempotent cleanup)
// ---------------------------------------------------------------------------

const tracked: { collection: string; id: string }[] = []

function track<T extends { id: string }>(collection: string, record: T): T {
  tracked.push({ collection, id: record.id })
  return record
}

export async function cleanup() {
  for (let i = tracked.length - 1; i >= 0; i--) {
    const { collection, id } = tracked[i]
    try {
      await pb.collection(collection).delete(id)
    } catch {
      // already gone (e.g. cascaded by a project/task delete)
    }
  }
  tracked.length = 0
}

/** Deletes every record in the test DB (projects cascade tasks/comments/checklist). */
export async function wipeAllData() {
  for (const p of await pb.collection("projects").getFullList<Project>()) {
    try {
      await pb.collection("projects").delete(p.id)
    } catch {
      // ignore
    }
  }
  for (const l of await pb.collection("labels").getFullList<Label>()) {
    try {
      await pb.collection("labels").delete(l.id)
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// UTC date helpers (mirror frontend/src/lib/dates.ts)
// ---------------------------------------------------------------------------

export function utcToday(): number {
  const d = new Date()
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

const DAY = 86_400_000

export function utcDaysFromNow(days: number): string {
  return new Date(utcToday() + days * DAY).toISOString()
}

/** Like utcDaysFromNow but at a specific UTC hour (e.g. 18 for 18:00). */
export function utcDaysFromNowAtHour(days: number, hour: number): string {
  return new Date(utcToday() + days * DAY + hour * 3_600_000).toISOString()
}

/** Format as YYYY-MM-DD (for the drawer's date input). */
export function utcInputDate(days: number): string {
  const d = new Date(utcToday() + days * DAY)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export async function createProject(name: string, color = "#6366f1") {
  return track("projects", await pb.collection("projects").create<Project>({ name, color }))
}

export async function createLabel(name: string, color = "#6366f1") {
  return track("labels", await pb.collection("labels").create<Label>({ name, color }))
}

export async function createTask(opts: {
  project: string
  title: string
  description?: string
  status?: TaskStatus
  dueDate?: string
  labels?: string[]
  order?: number
}) {
  return track(
    "tasks",
    await pb.collection("tasks").create<Task>({
      project: opts.project,
      title: opts.title,
      description: opts.description ?? "",
      status: opts.status ?? "todo",
      dueDate: opts.dueDate ?? "",
      labels: opts.labels ?? [],
      order: opts.order ?? 1024,
    })
  )
}

export async function createComment(taskId: string, text: string) {
  return track("comments", await pb.collection("comments").create<Comment>({ task: taskId, text }))
}

export async function createChecklistItem(taskId: string, text: string, checked = false, order = 1) {
  return track(
    "checklistItems",
    await pb.collection("checklistItems").create<ChecklistItem>({ task: taskId, text, checked, order })
  )
}

export async function uploadAttachment(taskId: string, name: string, content = "test content") {
  const fd = new FormData()
  fd.append("attachments", new Blob([content], { type: "text/plain" }), name)
  return track("tasks", await pb.collection("tasks").update<Task>(taskId, fd))
}

export async function getTask(id: string) {
  return pb.collection("tasks").getOne<Task>(id)
}

export async function listTasks() {
  return pb.collection("tasks").getFullList<Task>()
}

export async function listProjects() {
  return pb.collection("projects").getFullList<Project>()
}

export async function listLabels() {
  return pb.collection("labels").getFullList<Label>()
}

export async function listComments(taskId: string) {
  return pb.collection("comments").getFullList<Comment>({
    filter: pb.filter("task={:task}", { task: taskId }),
    sort: "created",
  })
}

export async function listChecklist(taskId: string) {
  return pb.collection("checklistItems").getFullList<ChecklistItem>({
    filter: pb.filter("task={:task}", { task: taskId }),
    sort: "order,created",
  })
}

// ---------------------------------------------------------------------------
// Stable locators
// ---------------------------------------------------------------------------

export function taskCard(page: Page, title: string) {
  return page.locator('[data-testid="task-card"]', { hasText: title }).first()
}

export function column(page: Page, status: TaskStatus) {
  return page.locator(`[data-testid="column-${status}"]`)
}

/** A task card inside a specific board column (avoids matching the dnd-kit
 *  sortable wrapper, which also exposes role="button"). */
export function columnCard(page: Page, status: TaskStatus, title: string) {
  return column(page, status).locator('[data-testid="task-card"]', { hasText: title })
}

export function dashboardSection(page: Page, key: string) {
  return page.locator(`[data-testid="section-${key}"]`)
}

export function dashboardSectionCount(page: Page, key: string) {
  return page.locator(`[data-testid="section-count-${key}"]`)
}

/** Expands a collapsible dashboard section (e.g. "today", "inprogress") if it
 *  has a toggle header. Idempotent: no-op if already expanded or for
 *  always-visible sections. Waits for the section to render first so it
 *  doesn't race the app's initial data load. */
export async function expandDashboardSection(page: Page, key: string) {
  const section = page.locator(`[data-testid="section-${key}"]`)
  await expect(section).toHaveCount(1)
  const toggle = section.locator(`[data-testid="section-toggle-${key}"]`)
  if ((await toggle.count()) === 0) return
  const chevron = toggle.locator("svg").first()
  const rotated = await chevron.evaluate((el) => el.classList.contains("rotate-90"))
  if (!rotated) await toggle.click()
}

/** The sidebar search input (avoids matching the hidden mobile-header input). */
export function searchInput(page: Page) {
  return page.locator("aside").getByPlaceholder("Search tasks…")
}

export async function openQuickCreate(page: Page) {
  await page.getByRole("button", { name: "New task" }).first().click()
  await expect(page.getByPlaceholder("What needs to be done?")).toBeVisible()
}

/** Waits until the app has loaded and the given project shows in the sidebar.
 *  Guards against a race where QuickCreate / the N shortcut fires before the
 *  projects query resolves (useQuickCreate then bails with no project). */
export async function waitForProject(page: Page, name: string) {
  await expect(page.locator("aside").getByRole("link", { name: new RegExp(name) })).toBeVisible()
}

/** Selects an option from an open Radix Select listbox. */
export async function pickSelectOption(page: Page, name: string) {
  await page.getByRole("option", { name }).click()
}

/** Drags a task card onto a target element via real mouse events (dnd-kit). */
export async function dragCard(page: Page, sourceTitle: string, target: Locator) {
  const source = taskCard(page, sourceTitle)
  await source.scrollIntoViewIfNeeded()
  await target.scrollIntoViewIfNeeded()
  const sb = await source.boundingBox()
  const tb = await target.boundingBox()
  if (!sb) throw new Error("source card not visible")
  if (!tb) throw new Error("target not visible")
  const sx = sb.x + sb.width / 2
  const sy = sb.y + sb.height / 2
  const tx = tb.x + tb.width / 2
  const ty = tb.y + tb.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 15, sy, { steps: 3 })
  await page.mouse.move(tx, ty, { steps: 30 })
  await page.mouse.up()
}

/** Drags an arbitrary handle locator onto a target locator via real mouse events. */
export async function dragHandleTo(page: Page, handle: Locator, target: Locator) {
  await handle.scrollIntoViewIfNeeded()
  await target.scrollIntoViewIfNeeded()
  const sb = await handle.boundingBox()
  const tb = await target.boundingBox()
  if (!sb) throw new Error("drag handle not visible")
  if (!tb) throw new Error("drag target not visible")
  const sx = sb.x + sb.width / 2
  const sy = sb.y + sb.height / 2
  const tx = tb.x + tb.width / 2
  const ty = tb.y + tb.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 10, sy + 5, { steps: 5 })
  await page.mouse.move(tx, ty, { steps: 25 })
  await page.mouse.up()
}

/** Drags a task card to absolute coordinates (for precise in-column reordering). */
export async function dragCardTo(page: Page, sourceTitle: string, x: number, y: number) {
  const source = taskCard(page, sourceTitle)
  await source.scrollIntoViewIfNeeded()
  const sb = await source.boundingBox()
  if (!sb) throw new Error("source card not visible")
  const sx = sb.x + sb.width / 2
  const sy = sb.y + sb.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 10, sy + 5, { steps: 5 })
  await page.mouse.move(x, y, { steps: 25 })
  await page.mouse.up()
}
