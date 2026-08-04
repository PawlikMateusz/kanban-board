import { useEffect, useState, type FormEvent } from "react"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, ListChecks, Trash2 } from "lucide-react"
import {
  ORDER_GAP,
  useAddChecklistItem,
  useChecklist,
  useDeleteChecklistItem,
  useReorderChecklist,
  useToggleChecklistItem,
} from "@/api/kanban"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import type { ChecklistItem, Task } from "@/types"
import { cn } from "@/lib/utils"

function SortableItem({
  item,
  taskId,
  toggleItem,
  deleteItem,
}: {
  item: ChecklistItem
  taskId: string
  toggleItem: ReturnType<typeof useToggleChecklistItem>
  deleteItem: ReturnType<typeof useDeleteChecklistItem>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  return (
    <div
      ref={setNodeRef}
      data-testid="checklist-item"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-1 rounded-md px-1 py-0.5 text-sm",
        isDragging && "opacity-40"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reorder item"
        className="shrink-0 cursor-grab touch-none p-0.5 text-muted-foreground/40 opacity-0 hover:text-muted-foreground group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Checkbox
        checked={!!item.checked}
        onCheckedChange={(checked) => toggleItem.mutate({ id: item.id, taskId, checked })}
      />
      <span
        className={cn(
          "flex-1 break-words",
          item.checked && "text-muted-foreground line-through"
        )}
      >
        {item.text}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
        title="Delete item"
        onClick={() => deleteItem.mutate({ id: item.id, taskId })}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export default function Checklist({ task }: { task: Task }) {
  const { data: items = [] } = useChecklist(task.id)
  const addItem = useAddChecklistItem()
  const toggleItem = useToggleChecklistItem()
  const deleteItem = useDeleteChecklistItem()
  const reorderItems = useReorderChecklist()
  const [text, setText] = useState("")

  useEffect(() => {
    setText("")
  }, [task.id])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const done = items.filter((i) => i.checked).length

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    const order = items.reduce((m, i) => Math.max(m, i.order ?? 0), 0) + 1
    addItem.mutate({ task: task.id, text: t, order })
    setText("")
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(items, oldIndex, newIndex)
    reorderItems.mutate({
      task: task.id,
      items: next.map((i, idx) => ({ id: i.id, order: (idx + 1) * ORDER_GAP })),
    })
  }

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" /> Checklist
        {items.length > 0 && (
          <span className="ml-auto font-normal normal-case">
            {done}/{items.length}
          </span>
        )}
      </p>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                taskId={task.id}
                toggleItem={toggleItem}
                deleteItem={deleteItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {items.length === 0 && <p className="text-xs text-muted-foreground">No items yet.</p>}
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an item…"
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={!text.trim()}>
          Add
        </Button>
      </form>
    </div>
  )
}
