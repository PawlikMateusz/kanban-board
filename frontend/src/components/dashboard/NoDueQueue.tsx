import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, GripVertical, X } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  applyQueueReorder,
  queryKeys,
  useRemoveFromQueue,
  useReorderQueue,
  useTasks,
  useUpdateTask,
} from "@/api/kanban"
import { TaskCard } from "@/components/task/TaskCard"
import { useUI } from "@/components/ui-provider"
import { cn } from "@/lib/utils"
import { utcDayMs } from "@/lib/dates"
import type { Task } from "@/types"

function QueueRow({
  task,
  onOpen,
  onRemove,
}: {
  task: Task
  onOpen: (id: string) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const updateTask = useUpdateTask()
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group flex items-center gap-2 px-2 py-2", isDragging && "opacity-50")}
    >
      <button
        type="button"
        {...listeners}
        data-testid="queue-handle"
        title="Reorder"
        className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <TaskCard bare task={task} onClick={() => onOpen(task.id)} showProject />
      <button
        type="button"
        data-testid="queue-complete"
        title="Mark as done"
        onClick={() => updateTask.mutate({ id: task.id, data: { status: "done" } })}
        className="shrink-0 rounded-full border bg-background p-1.5 text-emerald-500 opacity-0 shadow-sm transition-opacity hover:bg-emerald-500 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        data-testid="queue-remove"
        title="Remove from queue"
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/** "No-due queue": cards without a due date that can be reordered until they
 *  are scheduled. Sits at the bottom of the main dashboard. */
export default function NoDueQueue({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient()
  const { data: tasks = [] } = useTasks()
  const { hoveredDay } = useUI()
  const removeFromQueue = useRemoveFromQueue()
  const reorderQueue = useReorderQueue()
  const [active, setActive] = useState<Task | null>(null)

  const queued = useMemo(
    () =>
      tasks
        .filter((t) => t.queued && t.status !== "done" && utcDayMs(t.dueDate) === null)
        .sort(
          (a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0) || a.created.localeCompare(b.created)
        ),
    [tasks]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  function handleDragStart(e: DragStartEvent) {
    setActive(tasks.find((t) => t.id === e.active.id) ?? null)
  }

  function handleDragCancel(_e: DragCancelEvent) {
    setActive(null)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActive(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const to = queued.findIndex((t) => t.id === over.id)
    if (to < 0) return
    const { next, changed } = applyQueueReorder(tasks, String(active.id), to)
    if (changed.length === 0) return
    qc.setQueryData(queryKeys.tasks, next)
    reorderQueue.mutate(changed.map((t) => ({ id: t.id, queueOrder: t.queueOrder! })))
  }

  return (
    <section
      data-testid="section-queue"
      className={cn(
        "py-5 transition-opacity last:pb-0",
        // A queued card is never due on the hovered day, so fade the whole
        // section like the other non-matching timeline rows.
        hoveredDay !== null && "opacity-40"
      )}
    >
      <span data-testid="section-header-queue" className="mb-2 flex w-full items-center gap-2">
        <h2 className="text-sm font-semibold">Todo next</h2>
        <span
          data-testid="section-count-queue"
          className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {queued.length}
        </span>
      </span>
      {queued.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
          Cards without a due date can be parked here until you're ready to schedule them.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={queued.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-border">
                {queued.map((t) => (
                  <QueueRow
                    key={t.id}
                    task={t}
                    onOpen={onOpen}
                    onRemove={() => removeFromQueue.mutate(t.id)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {active ? (
                <div className="flex items-center gap-2 rounded-lg border bg-card px-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <TaskCard bare task={active} showProject />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </section>
  )
}
