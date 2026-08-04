import { useDroppable } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskCard } from "@/components/task/TaskCard"
import { STATUSES, type Task, type TaskStatus } from "@/types"
import { cn } from "@/lib/utils"

function SortableTaskCard({
  task,
  onOpenTask,
  registerCardNode,
}: {
  task: Task
  onOpenTask: (id: string) => void
  registerCardNode: (id: string, node: HTMLElement | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        registerCardNode(task.id, node)
      }}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-none rounded-md", isDragging && "opacity-40")}
    >
      <TaskCard task={task} onClick={() => onOpenTask(task.id)} />
    </div>
  )
}

export function Column({
  status,
  tasks,
  onOpenTask,
  onAddTask,
  registerCardNode,
  registerColumnNode,
}: {
  status: TaskStatus
  tasks: Task[]
  onOpenTask: (id: string) => void
  onAddTask: (status: TaskStatus) => void
  registerCardNode: (id: string, node: HTMLElement | null) => void
  registerColumnNode: (id: string, node: HTMLElement | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const meta = STATUSES.find((s) => s.value === status)!

  return (
    <div
      data-testid={`column-${status}`}
      ref={(node) => {
        setNodeRef(node)
        registerColumnNode(status, node)
      }}
      className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30"
    >
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.dot }} />
          <span className="text-sm font-medium">{meta.label}</span>
          <span data-testid={`column-count-${status}`} className="text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={`Add to ${meta.label}`}
          onClick={() => onAddTask(status)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={setNodeRef}
        data-testid={`column-drop-${status}`}
        className={cn(
          "flex min-h-20 flex-1 flex-col gap-2 overflow-y-auto rounded-b-lg px-2 pb-2",
          isOver && "bg-accent/50"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTaskCard
              key={t.id}
              task={t}
              onOpenTask={onOpenTask}
              registerCardNode={registerCardNode}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <button
            onClick={() => onAddTask(status)}
            className="mt-1 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
          >
            Add a task
          </button>
        )}
      </div>
    </div>
  )
}
