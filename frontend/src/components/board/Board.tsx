import { useCallback, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { applyMove, queryKeys, useMoveTask } from "@/api/kanban"
import { Column } from "@/components/board/Column"
import { TaskCard } from "@/components/task/TaskCard"
import { STATUSES, type Task, type TaskStatus } from "@/types"

export function Board({
  columns,
  onOpenTask,
  onAddTask,
}: {
  columns: Record<TaskStatus, Task[]>
  onOpenTask: (id: string) => void
  onAddTask: (status: TaskStatus) => void
}) {
  const qc = useQueryClient()
  const moveTask = useMoveTask()
  const startRef = useRef<Task[] | null>(null)
  const startMidsRef = useRef<Map<string, number>>(new Map())
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const readTasks = () => qc.getQueryData<Task[]>(queryKeys.tasks) ?? []

  // Maps each visible task id to its sortable DOM node so we can derive the
  // insertion point from the cursor position relative to the card positions.
  const cardNodes = useRef(new Map<string, HTMLElement>())
  const registerCardNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) cardNodes.current.set(id, node)
    else cardNodes.current.delete(id)
  }, [])

  // Maps each column status to its DOM node so the target column can be
  // derived from the cursor X alone (dnd-kit's `over` is unreliable during
  // fast drags, and after a live reorder it can point at the dragged card).
  const columnNodes = useRef(new Map<string, HTMLElement>())
  const registerColumnNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) columnNodes.current.set(id, node)
    else columnNodes.current.delete(id)
  }, [])

  /** Returns the dragged card's current on-screen centre (viewport coordinates)
   *  from a dnd-kit event. Using `active.rect.current.translated` rather than
   *  `activatorEvent + delta` keeps the position correct even when the board
   *  auto-scrolls during the drag (e.g. horizontally on touch devices), which
   *  `delta` alone does not account for. */
  function eventPos(e: {
    active: {
      rect: {
        current: {
          translated: { top: number; left: number; width: number; height: number } | null
        }
      }
    }
  }): { x: number; y: number } | null {
    const r = e.active.rect.current.translated
    if (!r) return null
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  /** The column whose horizontal span contains the cursor, or the nearest one. */
  function columnAtX(x: number): TaskStatus | null {
    let best: { s: TaskStatus; d: number } | null = null
    for (const [s, node] of columnNodes.current) {
      const rect = node.getBoundingClientRect()
      const d = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0
      if (best == null || d < best.d) best = { s: s as TaskStatus, d }
    }
    return best?.s ?? null
  }

  /** Insertion index within `siblings` for a card whose cursor is at `y`.
   *  Falls after every sibling whose vertical mid-point sits above the cursor. */
  function insertionIndex(
    siblings: Task[],
    midOf: (id: string) => number | undefined,
    y: number
  ): number {
    let index = siblings.length
    for (let i = 0; i < siblings.length; i++) {
      const mid = midOf(siblings[i].id)
      if (mid != null && mid >= y) {
        index = i
        break
      }
    }
    return index
  }

  /** Resolves the drop column + insertion index purely from the cursor
   *  position (column from X, insertion point from Y). It never depends on
   *  dnd-kit's `over`, so it behaves consistently whether the cursor is over
   *  a card, the empty part of a column, or the dragged card itself. */
  function resolveTarget(
    all: Task[],
    activeId: string,
    x: number,
    midOf: (id: string) => number | undefined,
    y: number
  ): { toStatus: TaskStatus; toIndex: number } | null {
    const active = all.find((t) => t.id === activeId)
    if (!active) return null
    const toStatus = columnAtX(x)
    if (!toStatus) return null
    // Positions are scoped to the dragged task's project (a board shows only one).
    const siblings = all
      .filter((t) => t.status === toStatus && t.id !== activeId && t.project === active.project)
      .sort((a, b) => a.order - b.order || a.created.localeCompare(b.created))
    return { toStatus, toIndex: insertionIndex(siblings, midOf, y) }
  }

  /** Midpoint of a card from its live DOM position (reflects live reordering). */
  function liveMid(id: string): number | undefined {
    const node = cardNodes.current.get(id)
    if (!node) return undefined
    const rect = node.getBoundingClientRect()
    return rect.top + rect.height / 2
  }

  function handleDragStart(e: DragStartEvent) {
    startRef.current = readTasks()
    // Snapshot the card positions from before the drag so the drop can be
    // resolved deterministically regardless of how much live reordering has
    // been applied by the time the pointer is released.
    const mids = new Map<string, number>()
    for (const [id, node] of cardNodes.current) {
      const rect = node.getBoundingClientRect()
      mids.set(id, rect.top + rect.height / 2)
    }
    startMidsRef.current = mids
    setActiveTask(readTasks().find((t) => t.id === e.active.id) ?? null)
  }

  /** Applies the live insertion while dragging. dnd-kit only fires
   *  `onDragOver` when the `over` target *changes*, so we also listen to
   *  `onDragMove` (every pointer move) and recompute the insertion point from
   *  the cursor position. Without this, moving a card within a column would
   *  not update until the cursor crossed another card or the drop happened,
   *  which makes reordering feel unreliable. */
  function handleDragMoveOver(e: DragOverEvent | DragMoveEvent) {
    const { active, over } = e
    if (!over) return
    const pos = eventPos(e)
    if (!pos) return
    const all = readTasks()
    const task = all.find((t) => t.id === active.id)
    if (!task) return
    const drop = resolveTarget(all, String(active.id), pos.x, liveMid, pos.y)
    if (!drop) return
    const { next, changed } = applyMove(all, task.id, drop.toStatus, drop.toIndex)
    if (changed.length === 0) return
    qc.setQueryData(queryKeys.tasks, next)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = e
    const initial = startRef.current
    const initialMids = startMidsRef.current
    startRef.current = null
    startMidsRef.current = new Map()
    if (!over) {
      // Dropped outside any droppable — the cache was only mutated
      // optimistically, so revert to the pre-drag state (nothing was persisted).
      if (initial) qc.setQueryData(queryKeys.tasks, initial)
      return
    }
    // Resolve the final position from the pre-drag snapshot and the cursor
    // position. This is intentionally independent of the live reordering (and
    // of React's effect timing) so the persisted place is deterministic. The
    // cursor-based logic is the same one used for live reordering, so when the
    // user drops at rest the result matches what they saw.
    const all = initial ?? readTasks()
    const task = all.find((t) => t.id === active.id)
    if (!task) return
    const pos = eventPos(e)
    if (!pos) return
    const midOf = (id: string) => initialMids.get(id)
    const dropTarget = resolveTarget(all, String(active.id), pos.x, midOf, pos.y)
    if (!dropTarget) {
      return
    }
    const { next, changed } = applyMove(all, task.id, dropTarget.toStatus, dropTarget.toIndex)
    if (changed.length === 0) return
    qc.setQueryData(queryKeys.tasks, next)
    const persisted = changed.filter((c) => {
      const orig = all.find((t) => t.id === c.id)
      return orig && (orig.status !== c.status || orig.order !== c.order)
    })
    if (persisted.length > 0) moveTask.mutate({ changed: persisted })
  }

  function handleDragCancel() {
    setActiveTask(null)
    const initial = startRef.current
    startRef.current = null
    if (initial) qc.setQueryData(queryKeys.tasks, initial)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragMoveOver}
      onDragMove={handleDragMoveOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div data-testid="board" className="flex h-full min-h-0 gap-3 overflow-x-auto px-4 pb-4">
        {STATUSES.map((s) => (
          <Column
            key={s.value}
            status={s.value}
            tasks={columns[s.value]}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
            registerCardNode={registerCardNode}
            registerColumnNode={registerColumnNode}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-72 rotate-2 cursor-grabbing">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
