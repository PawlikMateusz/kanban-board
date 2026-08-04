import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { pb } from "@/lib/pb"
import { uid } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import type { ChecklistItem, Comment, Label, Project, Task, TaskStatus } from "@/types"

export const queryKeys = {
  projects: ["projects"] as const,
  labels: ["labels"] as const,
  tasks: ["tasks"] as const,
  comments: (taskId: string) => ["comments", taskId] as const,
  checklist: (taskId: string) => ["checklist", taskId] as const,
  search: (q: string) => ["search", q] as const,
}

// Gap-based ordering: new tasks get (max + GAP), moves average the neighbours.
// Only renormalise a column when the gap collapses below 1.
export const ORDER_GAP = 1024

/** Turns any thrown error into a readable, human-friendly message. */
function friendlyError(e: unknown): string {
  const m = (e as { message?: unknown })?.message
  const detail = typeof m === "string" && m ? m : ""
  const lower = detail.toLowerCase()
  if (
    !detail ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("unexpected error") ||
    lower.includes("connection")
  ) {
    return "Could not reach the server. Check your connection."
  }
  return detail
}

const TASK_LIST = { expand: "project,labels", sort: "status,order,created" }

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => pb.collection("projects").getFullList<Project>({ sort: "order,created" }),
  })
}

export function useLabels() {
  return useQuery({
    queryKey: queryKeys.labels,
    queryFn: () => pb.collection("labels").getFullList<Label>({ sort: "created" }),
  })
}

export function useTasks() {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn: () => pb.collection("tasks").getFullList<Task>(TASK_LIST),
  })
}

export function useComments(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.comments(taskId ?? ""),
    queryFn: () =>
      pb.collection("comments").getFullList<Comment>({
        filter: pb.filter("task={:task}", { task: taskId }),
        sort: "created",
      }),
    enabled: !!taskId,
  })
}

/**
 * Maps every task id to the number of comments it has. Used by task cards
 * to show a comment indicator without opening the drawer.
 */
export function useCommentCounts() {
  return useQuery({
    queryKey: ["commentCounts"],
    queryFn: async () => {
      const comments = await pb.collection("comments").getFullList<Comment>({ fields: "task" })
      const counts = new Map<string, number>()
      for (const c of comments) {
        counts.set(c.task, (counts.get(c.task) ?? 0) + 1)
      }
      return counts
    },
  })
}

export function useChecklist(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.checklist(taskId ?? ""),
    queryFn: () =>
      pb.collection("checklistItems").getFullList<ChecklistItem>({
        filter: pb.filter("task={:task}", { task: taskId }),
        sort: "order,created",
      }),
    enabled: !!taskId,
  })
}

/**
 * Maps every task id to its checklist progress ({ total, done }). Used by
 * task cards to render a progress indicator.
 */
export function useChecklistStats() {
  return useQuery({
    queryKey: ["checklistStats"],
    queryFn: async () => {
      const items = await pb.collection("checklistItems").getFullList<ChecklistItem>({
        fields: "task,checked",
      })
      const stats = new Map<string, { total: number; done: number }>()
      for (const i of items) {
        const s = stats.get(i.task) ?? { total: 0, done: 0 }
        s.total += 1
        if (i.checked) s.done += 1
        stats.set(i.task, s)
      }
      return stats
    },
  })
}

export function useSearchTasks(q: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.search(q),
    queryFn: async () => {
      const result = await pb.collection("tasks").getList<Task>(1, 20, {
        filter: pb.filter("(title ~ {:q} || description ~ {:q})", { q }),
        expand: "project",
        sort: "-updated",
      })
      return result.items
    },
    enabled,
  })
}

// ---------------------------------------------------------------------------
// Move / ordering
// ---------------------------------------------------------------------------

/**
 * Computes the task list after moving `taskId` to `toStatus` at `toIndex`
 * (insertion index within the target column, excluding the moved task).
 * Uses gap-based ordering: order = (prev + next) / 2, with occasional
 * column renormalisation. Returns the optimistic `next` list and the set of
 * tasks whose status/order actually changed (normally just the moved task).
 */
export function applyMove(
  tasks: Task[],
  taskId: string,
  toStatus: TaskStatus,
  toIndex: number
): { next: Task[]; changed: Task[] } {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return { next: tasks, changed: [] }

  // Ordering is scoped to the moved task's project: a board only displays one
  // project, so insertion positions must be computed from that column's tasks
  // alone. Otherwise tasks from other projects interleave and make the gap
  // order land in a different visual position than the user dropped it.
  const siblings = tasks
    .filter((t) => t.status === toStatus && t.id !== taskId && t.project === task.project)
    .sort((a, b) => a.order - b.order || a.created.localeCompare(b.created))

  const idx = Math.max(0, Math.min(toIndex, siblings.length))
  const prev = siblings[idx - 1] ?? null
  const next = siblings[idx] ?? null

  let newOrder: number
  let renormalise = false
  if (!prev && !next) {
    newOrder = ORDER_GAP
  } else if (!prev && next) {
    newOrder = next.order - ORDER_GAP
  } else if (prev && !next) {
    newOrder = prev.order + ORDER_GAP
  } else {
    newOrder = (prev.order + next.order) / 2
    if (newOrder <= prev.order || newOrder >= next.order || next.order - prev.order <= 1) {
      renormalise = true
    }
  }

  if (renormalise) {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    const changedMap = new Map<string, { status: TaskStatus; order: number }>()
    const ids = [...siblings.map((t) => t.id)]
    ids.splice(idx, 0, taskId)
    ids.forEach((id, i) => {
      const orig = byId.get(id)!
      const order = (i + 1) * ORDER_GAP
      if (orig.status !== toStatus || orig.order !== order) {
        changedMap.set(id, { status: toStatus, order })
      }
    })
    const nextList = tasks.map((t) => {
      const c = changedMap.get(t.id)
      return c ? { ...t, status: c.status, order: c.order } : t
    })
    const changed = [...changedMap.entries()].map(([id, c]) => ({
      ...byId.get(id)!,
      status: c.status,
      order: c.order,
    }))
    return { next: nextList, changed }
  }

  if (task.status !== toStatus || task.order !== newOrder) {
    const moved = { ...task, status: toStatus, order: newOrder }
    return { next: tasks.map((t) => (t.id === taskId ? moved : t)), changed: [moved] }
  }
  return { next: tasks, changed: [] }
}

/** Max gap-based order currently used in a project/status column. */
export function nextOrder(tasks: Task[], projectId: string, status: TaskStatus): number {
  const max = tasks
    .filter((t) => t.project === projectId && t.status === status)
    .reduce((acc, t) => Math.max(acc, t.order), 0)
  return max + ORDER_GAP
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function useCreateProject() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (data: { name: string; color: string; order?: number }) =>
      pb.collection("projects").create<Project>(data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: queryKeys.projects })
      const prev = qc.getQueryData<Project[]>(queryKeys.projects) ?? []
      const temp: Project = {
        id: `temp-${uid()}`,
        ...data,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      qc.setQueryData(queryKeys.projects, [...prev, temp])
      return { prev, tempId: temp.id }
    },
    onSuccess: (created, _data, ctx) => {
      const projects = qc.getQueryData<Project[]>(queryKeys.projects) ?? []
      qc.setQueryData(
        queryKeys.projects,
        projects.map((p) => (p.id === ctx?.tempId ? created : p))
      )
    },
    onError: (e, _d, ctx) => {
      toast(friendlyError(e))
      if (ctx) qc.setQueryData(queryKeys.projects, ctx.prev)
    },
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) =>
      pb.collection("projects").update<Project>(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.projects })
      const prev = qc.getQueryData<Project[]>(queryKeys.projects) ?? []
      qc.setQueryData(
        queryKeys.projects,
        prev.map((p) => (p.id === id ? { ...p, ...data } : p))
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      toast("Failed to save project")
      if (ctx) qc.setQueryData(queryKeys.projects, ctx.prev)
    },
  })
}

/**
 * Persists a new project ordering. `ordered` is the full list in display
 * order with its new `order` values; the tasks/cache are updated optimistically.
 */
export function useReorderProjects() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (ordered: { id: string; order: number }[]) =>
      Promise.all(ordered.map(({ id, order }) => pb.collection("projects").update(id, { order }))),
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: queryKeys.projects })
      const prev = qc.getQueryData<Project[]>(queryKeys.projects) ?? []
      const orderById = new Map(ordered.map((o) => [o.id, o.order]))
      const byId = new Map(prev.map((p) => [p.id, p]))
      const next: Project[] = []
      for (const o of ordered) {
        const orig = byId.get(o.id)
        if (orig) next.push({ ...orig, order: o.order })
      }
      const missing = prev.filter((p) => !orderById.has(p.id))
      qc.setQueryData(queryKeys.projects, [...next, ...missing])
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      toast("Failed to reorder projects")
      if (ctx) qc.setQueryData(queryKeys.projects, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.projects }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) => pb.collection("projects").delete(id),
    onError: (_e) => toast("Failed to delete project"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects })
      qc.invalidateQueries({ queryKey: queryKeys.tasks })
    },
  })
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function useCreateLabel() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      pb.collection("labels").create<Label>(data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: queryKeys.labels })
      const prev = qc.getQueryData<Label[]>(queryKeys.labels) ?? []
      const temp: Label = {
        id: `temp-${uid()}`,
        ...data,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      qc.setQueryData(queryKeys.labels, [...prev, temp])
      return { prev, tempId: temp.id }
    },
    onSuccess: (created, _data, ctx) => {
      const labels = qc.getQueryData<Label[]>(queryKeys.labels) ?? []
      qc.setQueryData(
        queryKeys.labels,
        labels.map((l) => (l.id === ctx?.tempId ? created : l))
      )
    },
    onError: (e, _d, ctx) => {
      toast(friendlyError(e))
      if (ctx) qc.setQueryData(queryKeys.labels, ctx.prev)
    },
  })
}

export function useUpdateLabel() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Label> }) =>
      pb.collection("labels").update<Label>(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.labels })
      const prev = qc.getQueryData<Label[]>(queryKeys.labels) ?? []
      qc.setQueryData(
        queryKeys.labels,
        prev.map((l) => (l.id === id ? { ...l, ...data } : l))
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      toast("Failed to save label")
      if (ctx) qc.setQueryData(queryKeys.labels, ctx.prev)
    },
  })
}

export function useDeleteLabel() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async (id: string) => {
      const tasks = await pb.collection("tasks").getFullList<Task>({
        filter: pb.filter("labels~{:id}", { id }),
      })
      await Promise.all(
        tasks.map((t) =>
          pb.collection("tasks").update(t.id, { labels: t.labels.filter((l) => l !== id) })
        )
      )
      await pb.collection("labels").delete(id)
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.labels })
      await qc.cancelQueries({ queryKey: queryKeys.tasks })
      const prevLabels = qc.getQueryData<Label[]>(queryKeys.labels) ?? []
      const prevTasks = qc.getQueryData<Task[]>(queryKeys.tasks) ?? []
      qc.setQueryData(
        queryKeys.labels,
        prevLabels.filter((l) => l.id !== id)
      )
      qc.setQueryData(
        queryKeys.tasks,
        prevTasks.map((t) => ({ ...t, labels: t.labels.filter((l) => l !== id) }))
      )
      return { prevLabels, prevTasks }
    },
    onError: (_e, _v, ctx) => {
      toast("Failed to delete label")
      if (ctx) {
        qc.setQueryData(queryKeys.labels, ctx.prevLabels)
        qc.setQueryData(queryKeys.tasks, ctx.prevTasks)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.labels })
      qc.invalidateQueries({ queryKey: queryKeys.tasks })
    },
  })
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type CreateTaskInput = {
  project: string
  title: string
  description: string
  status: TaskStatus
  dueDate: string
  labels: string[]
  order: number
}

export function useCreateTask() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (data: CreateTaskInput) =>
      pb.collection("tasks").create<Task>({
        project: data.project,
        title: data.title,
        description: data.description,
        status: data.status,
        dueDate: data.dueDate || "",
        labels: data.labels,
        order: data.order,
      }),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasks })
      const prev = qc.getQueryData<Task[]>(queryKeys.tasks) ?? []
      const temp: Task = {
        id: `temp-${uid()}`,
        collectionId: "",
        project: data.project,
        title: data.title,
        description: data.description,
        status: data.status,
        dueDate: data.dueDate || "",
        order: data.order,
        labels: data.labels,
        attachments: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      qc.setQueryData(queryKeys.tasks, [...prev, temp])
      return { prev, tempId: temp.id }
    },
    onSuccess: (created, _data, ctx) => {
      const tasks = qc.getQueryData<Task[]>(queryKeys.tasks) ?? []
      qc.setQueryData(
        queryKeys.tasks,
        tasks.map((t) => (t.id === ctx?.tempId ? created : t))
      )
    },
    onError: (e, _d, ctx) => {
      toast(friendlyError(e))
      if (ctx) qc.setQueryData(queryKeys.tasks, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      pb.collection("tasks").update<Task>(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasks })
      const prev = qc.getQueryData<Task[]>(queryKeys.tasks) ?? []
      qc.setQueryData(
        queryKeys.tasks,
        prev.map((t) => (t.id === id ? ({ ...t, ...data } as Task) : t))
      )
      return { prev }
    },
    onError: (e, _v, ctx) => {
      toast(friendlyError(e))
      if (ctx) qc.setQueryData(queryKeys.tasks, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) => pb.collection("tasks").delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasks })
      const prev = qc.getQueryData<Task[]>(queryKeys.tasks) ?? []
      qc.setQueryData(
        queryKeys.tasks,
        prev.filter((t) => t.id !== id)
      )
      return { prev }
    },
    onError: (e, _v, ctx) => {
      toast(friendlyError(e))
      if (ctx) qc.setQueryData(queryKeys.tasks, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

export function useMoveTask() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ changed }: { changed: Task[] }) =>
      Promise.all(
        changed.map((t) =>
          pb.collection("tasks").update(t.id, { status: t.status, order: t.order })
        )
      ),
    onError: (_e) => {
      toast("Failed to move task")
      qc.invalidateQueries({ queryKey: queryKeys.tasks, refetchType: "all" })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

/**
 * Moves a task to another project. The caller supplies the gap-based `order`
 * within the target project's column (same status is kept), so the card lands
 * at the right visual position in the destination board.
 */
export function useMoveTaskToProject() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, project, order }: { id: string; project: string; order: number }) =>
      pb.collection("tasks").update<Task>(id, { project, order }),
    onMutate: async ({ id, project, order }) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasks })
      const prev = qc.getQueryData<Task[]>(queryKeys.tasks) ?? []
      qc.setQueryData(
        queryKeys.tasks,
        prev.map((t) => (t.id === id ? { ...t, project, order } : t))
      )
      return { prev }
    },
    onError: (e, _v, ctx) => {
      toast(friendlyError(e))
      if (ctx) qc.setQueryData(queryKeys.tasks, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

// ---------------------------------------------------------------------------
// No-due queue
// ---------------------------------------------------------------------------

/** Max gap-based order currently used in the no-due queue. */
export function nextQueueOrder(tasks: Task[]): number {
  const max = tasks.filter((t) => t.queued).reduce((acc, t) => Math.max(acc, t.queueOrder ?? 0), 0)
  return max + ORDER_GAP
}

/**
 * Computes the task list after moving `taskId` to `toIndex` within the no-due
 * queue. Uses the same gap-based ordering as the board columns and returns the
 * optimistic `next` list plus the tasks whose `queueOrder` actually changed.
 */
export function applyQueueReorder(
  tasks: Task[],
  taskId: string,
  toIndex: number
): { next: Task[]; changed: Task[] } {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return { next: tasks, changed: [] }

  const siblings = tasks
    .filter((t) => t.queued && t.id !== taskId)
    .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0) || a.created.localeCompare(b.created))

  const idx = Math.max(0, Math.min(toIndex, siblings.length))
  const prev = siblings[idx - 1] ?? null
  const next = siblings[idx] ?? null

  let newOrder: number
  let renormalise = false
  if (!prev && !next) {
    newOrder = ORDER_GAP
  } else if (!prev && next) {
    newOrder = (next.queueOrder ?? 0) - ORDER_GAP
  } else if (prev && !next) {
    newOrder = (prev.queueOrder ?? 0) + ORDER_GAP
  } else {
    newOrder = ((prev.queueOrder ?? 0) + (next.queueOrder ?? 0)) / 2
    if (
      newOrder <= (prev.queueOrder ?? 0) ||
      newOrder >= (next.queueOrder ?? 0) ||
      (next.queueOrder ?? 0) - (prev.queueOrder ?? 0) <= 1
    ) {
      renormalise = true
    }
  }

  if (renormalise) {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    const changedMap = new Map<string, number>()
    const ids = [...siblings.map((t) => t.id)]
    ids.splice(idx, 0, taskId)
    ids.forEach((id, i) => {
      const order = (i + 1) * ORDER_GAP
      const orig = byId.get(id)!
      if ((orig.queueOrder ?? 0) !== order) changedMap.set(id, order)
    })
    const nextList = tasks.map((t) => {
      const o = changedMap.get(t.id)
      return o !== undefined ? { ...t, queued: true, queueOrder: o } : t
    })
    const changed = [...changedMap.entries()].map(([id, order]) => ({
      ...byId.get(id)!,
      queued: true,
      queueOrder: order,
    }))
    return { next: nextList, changed }
  }

  if (task.queued !== true || (task.queueOrder ?? 0) !== newOrder) {
    const moved = { ...task, queued: true, queueOrder: newOrder }
    return { next: tasks.map((t) => (t.id === taskId ? moved : t)), changed: [moved] }
  }
  return { next: tasks, changed: [] }
}

export function useAddToQueue() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, queueOrder }: { id: string; queueOrder: number }) =>
      pb.collection("tasks").update<Task>(id, { queued: true, queueOrder }),
    onMutate: async ({ id, queueOrder }) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasks })
      const prev = qc.getQueryData<Task[]>(queryKeys.tasks) ?? []
      qc.setQueryData(
        queryKeys.tasks,
        prev.map((t) => (t.id === id ? { ...t, queued: true, queueOrder } : t))
      )
      return { prev }
    },
    onError: (e, _v, ctx) => {
      toast(friendlyError(e))
      if (ctx) qc.setQueryData(queryKeys.tasks, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

export function useRemoveFromQueue() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) =>
      pb.collection("tasks").update<Task>(id, { queued: false, queueOrder: null }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasks })
      const prev = qc.getQueryData<Task[]>(queryKeys.tasks) ?? []
      qc.setQueryData(
        queryKeys.tasks,
        prev.map((t) => (t.id === id ? { ...t, queued: false, queueOrder: null } : t))
      )
      return { prev }
    },
    onError: (e, _v, ctx) => {
      toast(friendlyError(e))
      if (ctx) qc.setQueryData(queryKeys.tasks, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

/**
 * Persists a new queue ordering. `ordered` is the full queued list in display
 * order with its new `queueOrder` values.
 */
export function useReorderQueue() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (ordered: { id: string; queueOrder: number }[]) =>
      Promise.all(
        ordered.map(({ id, queueOrder }) => pb.collection("tasks").update(id, { queueOrder }))
      ),
    onError: (_e) => {
      toast("Failed to reorder queue")
      qc.invalidateQueries({ queryKey: queryKeys.tasks, refetchType: "all" })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function useCreateComment() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ task, text }: { task: string; text: string }) =>
      pb.collection("comments").create<Comment>({ task, text }),
    onMutate: async ({ task, text }) => {
      await qc.cancelQueries({ queryKey: queryKeys.comments(task) })
      const prev = qc.getQueryData<Comment[]>(queryKeys.comments(task)) ?? []
      const temp: Comment = {
        id: `temp-${uid()}`,
        task,
        text,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      qc.setQueryData(queryKeys.comments(task), [...prev, temp])
      return { prev, tempId: temp.id, task }
    },
    onSuccess: (created, _v, ctx) => {
      if (!ctx) return
      const comments = qc.getQueryData<Comment[]>(queryKeys.comments(ctx.task)) ?? []
      qc.setQueryData(
        queryKeys.comments(ctx.task),
        comments.map((c) => (c.id === ctx.tempId ? created : c))
      )
    },
    onError: (e, _v, ctx) => {
      toast("Failed to add comment")
      if (ctx) qc.setQueryData(queryKeys.comments(ctx.task), ctx.prev)
    },
    onSettled: (_d, _e, _v, ctx) => {
      if (ctx) {
        qc.invalidateQueries({ queryKey: queryKeys.comments(ctx.task) })
        qc.invalidateQueries({ queryKey: ["commentCounts"] })
      }
    },
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ task: _task, id }: { task: string; id: string }) =>
      pb.collection("comments").delete(id),
    onMutate: async ({ task, id }) => {
      await qc.cancelQueries({ queryKey: queryKeys.comments(task) })
      const prev = qc.getQueryData<Comment[]>(queryKeys.comments(task)) ?? []
      qc.setQueryData(
        queryKeys.comments(task),
        prev.filter((c) => c.id !== id)
      )
      return { prev, task }
    },
    onError: (_e, _v, ctx) => {
      toast("Failed to delete comment")
      if (ctx) qc.setQueryData(queryKeys.comments(ctx.task), ctx.prev)
    },
    onSettled: (_d, _e, _v, ctx) => {
      if (ctx) {
        qc.invalidateQueries({ queryKey: queryKeys.comments(ctx.task) })
        qc.invalidateQueries({ queryKey: ["commentCounts"] })
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export function useAddAttachments() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ taskId, files }: { taskId: string; files: File[] }) => {
      const fd = new FormData()
      files.forEach((f) => fd.append("attachments", f))
      return pb.collection("tasks").update<Task>(taskId, fd)
    },
    onError: (_e) => toast("Failed to upload attachment"),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

export function useRemoveAttachment() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ taskId, filename }: { taskId: string; filename: string }) =>
      pb.collection("tasks").update<Task>(taskId, { "attachments-": [filename] }),
    onMutate: async ({ taskId, filename }) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasks })
      const prev = qc.getQueryData<Task[]>(queryKeys.tasks) ?? []
      qc.setQueryData(
        queryKeys.tasks,
        prev.map((t) =>
          t.id === taskId ? { ...t, attachments: t.attachments.filter((f) => f !== filename) } : t
        )
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      toast("Failed to remove attachment")
      if (ctx) qc.setQueryData(queryKeys.tasks, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

// ---------------------------------------------------------------------------
// Checklist items
// ---------------------------------------------------------------------------

export function useAddChecklistItem() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ task, text, order }: { task: string; text: string; order: number }) =>
      pb.collection("checklistItems").create<ChecklistItem>({ task, text, checked: false, order }),
    onMutate: async ({ task, text, order }) => {
      await qc.cancelQueries({ queryKey: queryKeys.checklist(task) })
      const prev = qc.getQueryData<ChecklistItem[]>(queryKeys.checklist(task)) ?? []
      const temp: ChecklistItem = {
        id: `temp-${uid()}`,
        task,
        text,
        checked: false,
        order,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      qc.setQueryData(queryKeys.checklist(task), [...prev, temp])
      return { prev, tempId: temp.id, task }
    },
    onSuccess: (created, _v, ctx) => {
      if (!ctx) return
      const items = qc.getQueryData<ChecklistItem[]>(queryKeys.checklist(ctx.task)) ?? []
      qc.setQueryData(
        queryKeys.checklist(ctx.task),
        items.map((i) => (i.id === ctx.tempId ? created : i))
      )
    },
    onError: (_e, _v, ctx) => {
      toast("Failed to add item")
      if (ctx) qc.setQueryData(queryKeys.checklist(ctx.task), ctx.prev)
    },
    onSettled: (_d, _e, _v, ctx) => {
      if (ctx) {
        qc.invalidateQueries({ queryKey: queryKeys.checklist(ctx.task) })
        qc.invalidateQueries({ queryKey: ["checklistStats"] })
      }
    },
  })
}

export function useToggleChecklistItem() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, checked }: { id: string; taskId: string; checked: boolean }) =>
      pb.collection("checklistItems").update<ChecklistItem>(id, { checked }),
    onMutate: async ({ id, taskId, checked }: { id: string; taskId: string; checked: boolean }) => {
      await qc.cancelQueries({ queryKey: queryKeys.checklist(taskId) })
      const prev = qc.getQueryData<ChecklistItem[]>(queryKeys.checklist(taskId)) ?? []
      qc.setQueryData(
        queryKeys.checklist(taskId),
        prev.map((i) => (i.id === id ? { ...i, checked } : i))
      )
      return { prev, taskId }
    },
    onError: (_e, _v, ctx) => {
      toast("Failed to update item")
      if (ctx) qc.setQueryData(queryKeys.checklist(ctx.taskId), ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["checklistStats"] })
    },
  })
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id }: { id: string; taskId: string }) =>
      pb.collection("checklistItems").delete(id),
    onMutate: async ({ id, taskId }: { id: string; taskId: string }) => {
      await qc.cancelQueries({ queryKey: queryKeys.checklist(taskId) })
      const prev = qc.getQueryData<ChecklistItem[]>(queryKeys.checklist(taskId)) ?? []
      qc.setQueryData(
        queryKeys.checklist(taskId),
        prev.filter((i) => i.id !== id)
      )
      return { prev, taskId }
    },
    onError: (_e, _v, ctx) => {
      toast("Failed to delete item")
      if (ctx) qc.setQueryData(queryKeys.checklist(ctx.taskId), ctx.prev)
    },
    onSettled: (_d, _e, _v, ctx) => {
      if (ctx?.taskId) qc.invalidateQueries({ queryKey: queryKeys.checklist(ctx.taskId) })
      qc.invalidateQueries({ queryKey: ["checklistStats"] })
    },
  })
}

/**
 * Persists a new checklist ordering. `ordered` is the full list in display
 * order with its new `order` values.
 */
export function useReorderChecklist() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ items }: { task: string; items: { id: string; order: number }[] }) =>
      Promise.all(
        items.map(({ id, order }) => pb.collection("checklistItems").update(id, { order }))
      ),
    onMutate: async ({ task, items }: { task: string; items: { id: string; order: number }[] }) => {
      await qc.cancelQueries({ queryKey: queryKeys.checklist(task) })
      const prev = qc.getQueryData<ChecklistItem[]>(queryKeys.checklist(task)) ?? []
      const orderById = new Map(items.map((o) => [o.id, o.order]))
      const byId = new Map(prev.map((i) => [i.id, i]))
      const next: ChecklistItem[] = []
      for (const o of items) {
        const orig = byId.get(o.id)
        if (orig) next.push({ ...orig, order: o.order })
      }
      const missing = prev.filter((i) => !orderById.has(i.id))
      qc.setQueryData(queryKeys.checklist(task), [...next, ...missing])
      return { prev, task }
    },
    onError: (_e, _v, ctx) => {
      toast("Failed to reorder items")
      if (ctx) qc.setQueryData(queryKeys.checklist(ctx.task), ctx.prev)
    },
    onSettled: (_d, _e, _v, ctx) => {
      if (ctx) qc.invalidateQueries({ queryKey: queryKeys.checklist(ctx.task) })
    },
  })
}
