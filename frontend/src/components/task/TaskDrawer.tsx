import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Check, FolderKanban, ListPlus, ListX, Trash2, X } from "lucide-react"
import {
  nextOrder,
  nextQueueOrder,
  useAddToQueue,
  useDeleteTask,
  useLabels,
  useMoveTaskToProject,
  useProjects,
  useRemoveFromQueue,
  useTasks,
  useUpdateTask,
} from "@/api/kanban"
import { useUI } from "@/components/ui-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import CalendarSync from "@/components/task/CalendarSync"
import CommentList from "@/components/task/CommentList"
import AttachmentList from "@/components/task/AttachmentList"
import { LabelBadge } from "@/components/task/LabelBadge"
import LabelPicker from "@/components/task/LabelPicker"
import Checklist from "@/components/task/Checklist"
import { STATUSES, type TaskStatus } from "@/types"
import { cn } from "@/lib/utils"

export default function TaskDrawer() {
  const { activeTaskId, closeTask } = useUI()
  const { data: tasks = [] } = useTasks()
  const { data: projects = [] } = useProjects()
  const { data: labels = [] } = useLabels()
  const task = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  )
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const moveTaskToProject = useMoveTaskToProject()
  const addToQueue = useAddToQueue()
  const removeFromQueue = useRemoveFromQueue()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [projectOpen, setProjectOpen] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? "")
      setDueDate(task.dueDate ?? "")
    }
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeTaskId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeTask()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeTaskId, closeTask])

  const open = !!activeTaskId

  return (
    <>
      <div
        onClick={closeTask}
        data-testid="task-drawer-backdrop"
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity sm:bg-black/20",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        data-testid="task-drawer"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-background shadow-2xl transition-transform duration-200 sm:w-[420px]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {task ? (
          <>
            <div className="flex items-center gap-1 border-b px-3 py-2 sm:px-4">
              <Select
                value={task.status}
                onValueChange={(v) =>
                  updateTask.mutate({ id: task.id, data: { status: v as TaskStatus } })
                }
              >
                <SelectTrigger data-testid="drawer-status" className="h-8 w-[110px]">
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

              <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    data-testid="drawer-project"
                    title="Move to project"
                    aria-label="Move to project"
                  >
                    <FolderKanban className="h-4 w-4" />
                    <span
                      className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full ring-2 ring-background"
                      style={{
                        backgroundColor:
                          projects.find((p) => p.id === task.project)?.color ?? "#64748b",
                      }}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="end">
                  <div role="listbox">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        role="option"
                        aria-selected={p.id === task.project}
                        onClick={() => {
                          if (p.id !== task.project) {
                            moveTaskToProject.mutate({
                              id: task.id,
                              project: p.id,
                              order: nextOrder(tasks, p.id, task.status),
                            })
                          }
                          setProjectOpen(false)
                        }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: p.color || "#64748b" }}
                        />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {p.id === task.project && (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <LabelPicker task={task} />

              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                title="Delete task"
                onClick={() => deleteTask.mutate(task.id, { onSuccess: closeTask })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Close" onClick={closeTask}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  const v = title.trim()
                  if (v && v !== task.title) updateTask.mutate({ id: task.id, data: { title: v } })
                  else setTitle(task.title)
                }}
                placeholder="Task title"
                className="h-auto border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
              />

              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  if (description !== (task.description ?? "")) {
                    updateTask.mutate({ id: task.id, data: { description } })
                  }
                }}
                placeholder="Add a description…"
                className="min-h-[80px] resize-none"
              />

              {labels.filter((l) => task.labels.includes(l.id)).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {labels
                    .filter((l) => task.labels.includes(l.id))
                    .map((l) => (
                      <LabelBadge key={l.id} label={l} />
                    ))}
                </div>
              )}

              <div>
                <p className="mb-1.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" /> Due date
                </p>
                <DateTimePicker
                  value={dueDate}
                  onChange={(iso) => {
                    setDueDate(iso)
                    // A scheduled card no longer belongs in the no-due queue.
                    updateTask.mutate({
                      id: task.id,
                      data: { dueDate: iso, queued: iso ? false : task.queued },
                    })
                  }}
                />
              </div>

              <CalendarSync task={task} />

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Queue
                </p>
                {task.queued ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    data-testid="drawer-remove-queue"
                    onClick={() => removeFromQueue.mutate(task.id)}
                  >
                    <ListX className="h-4 w-4" /> Remove from queue
                  </Button>
                ) : dueDate ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    data-testid="drawer-add-queue"
                    disabled
                    title="Only cards without a due date can be added to the queue"
                  >
                    <ListPlus className="h-4 w-4" /> Add to queue
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    data-testid="drawer-add-queue"
                    onClick={() =>
                      addToQueue.mutate({ id: task.id, queueOrder: nextQueueOrder(tasks) })
                    }
                  >
                    <ListPlus className="h-4 w-4" /> Add to queue
                  </Button>
                )}
              </div>

              <Checklist task={task} />

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Attachments
                </p>
                <AttachmentList task={task} />
              </div>

              <Separator />

              <CommentList task={task} />
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a task to view details
          </div>
        )}
      </aside>
    </>
  )
}
