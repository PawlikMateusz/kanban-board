export type TaskStatus = "todo" | "doing" | "done"

export const STATUSES: { value: TaskStatus; label: string; dot: string }[] = [
  { value: "todo", label: "Todo", dot: "#64748b" },
  { value: "doing", label: "Doing", dot: "#f59e0b" },
  { value: "done", label: "Done", dot: "#22c55e" },
]

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Todo",
  doing: "Doing",
  done: "Done",
}

export type Project = {
  id: string
  name: string
  color: string
  order?: number | null
  created: string
  updated: string
}

export type Label = {
  id: string
  name: string
  color: string
  created: string
  updated: string
}

export type Task = {
  id: string
  collectionId: string
  project: string
  title: string
  description: string
  status: TaskStatus
  dueDate: string
  order: number
  labels: string[]
  attachments: string[]
  queued?: boolean
  queueOrder?: number | null
  created: string
  updated: string
  expand?: {
    project?: Project
    labels?: Label[]
  }
}

export type Comment = {
  id: string
  task: string
  text: string
  created: string
  updated: string
}

export type ChecklistItem = {
  id: string
  task: string
  text: string
  checked: boolean
  order: number
  created: string
  updated: string
}
