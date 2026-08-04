import { useEffect, useRef, useState } from "react"
import { Plus } from "lucide-react"
import {
  useCreateLabel,
  useDeleteTask,
  useLabels,
  useProjects,
  useTasks,
  useUpdateTask,
} from "@/api/kanban"
import { useUI } from "@/components/ui-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { STATUSES, type TaskStatus } from "@/types"
import { cn } from "@/lib/utils"

/**
 * Inline editor for an already-created (empty) task.
 * Enter commits the title, Esc or click-away deletes the empty task.
 */
export default function QuickCreate() {
  const { quickCreate, closeQuickCreate } = useUI()
  const { data: projects = [] } = useProjects()
  const { data: labels = [] } = useLabels()
  const { data: tasks = [] } = useTasks()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const createLabel = useCreateLabel()

  const inputRef = useRef<HTMLInputElement>(null)
  // Tracks the current uncommitted (empty-title) task so that if a new
  // QuickCreate opens before the current one is saved, the abandoned empty
  // task is deleted instead of leaking as a blank card in the DB.
  const pendingRef = useRef<string | null>(null)
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<TaskStatus>("todo")
  const [projectId, setProjectId] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState("")

  useEffect(() => {
    if (quickCreate) {
      const prevPending = pendingRef.current
      if (prevPending && prevPending !== quickCreate.taskId) {
        if (tasks.some((t) => t.id === prevPending)) deleteTask.mutate(prevPending)
      }
      pendingRef.current = quickCreate.taskId
      setTitle("")
      setStatus(quickCreate.status)
      setProjectId(quickCreate.projectId)
      setDueDate("")
      setSelectedLabels([])
      setNewLabel("")
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [quickCreate]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!quickCreate) return null
  const create = quickCreate

  const task = tasks.find((t) => t.id === create.taskId)
  if (!task) return null

  const q = newLabel.trim().toLowerCase()
  const visibleLabels = q ? labels.filter((l) => l.name.toLowerCase().includes(q)) : labels

  function toggleLabel(id: string) {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function addLabel() {
    const name = newLabel.trim()
    if (!name) return
    const existing = labels.find((l) => l.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      setSelectedLabels((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]))
    } else {
      const created = await createLabel.mutateAsync({ name, color: "#6366f1" })
      setSelectedLabels((prev) => [...prev, created.id])
    }
    setNewLabel("")
  }

  function commit() {
    const t = title.trim()
    if (t) {
      updateTask.mutate({
        id: create.taskId,
        data: { title: t, project: projectId, status, labels: selectedLabels, dueDate },
      })
    } else {
      deleteTask.mutate(create.taskId)
    }
    pendingRef.current = null
    closeQuickCreate()
  }

  function cancel() {
    deleteTask.mutate(create.taskId)
    pendingRef.current = null
    closeQuickCreate()
  }

  return (
    <div
      data-testid="quick-create"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onMouseDown={cancel}
    >
      <div
        className="w-full max-w-lg rounded-lg border bg-background p-4 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            New task
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger data-testid="qc-project" className="h-8 w-auto gap-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger data-testid="qc-status" className="h-8 w-auto gap-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") cancel()
          }}
          placeholder="What needs to be done?"
          className="h-10 text-base"
        />

        <div className="mt-3">
          <DateTimePicker value={dueDate} onChange={setDueDate} />
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {visibleLabels.map((l) => {
              const on = selectedLabels.includes(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleLabel(l.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors",
                    on
                      ? "border-primary bg-primary/10 font-medium"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: l.color || "#64748b" }}
                  />
                  {l.name}
                </button>
              )
            })}
            {labels.length === 0 && (
              <span className="text-xs text-muted-foreground">No labels yet.</span>
            )}
            {labels.length > 0 && visibleLabels.length === 0 && newLabel.trim() && (
              <span className="text-xs text-muted-foreground">
                No matching labels — type and press Enter to add "{newLabel.trim()}"
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void addLabel()
                }
              }}
              placeholder="New label name…"
              className="h-8 flex-1 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void addLabel()}
              disabled={!newLabel.trim()}
            >
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Enter</kbd> to save ·{" "}
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Esc</kbd> to cancel
          </span>
          <Button size="sm" onClick={commit} disabled={!title.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
