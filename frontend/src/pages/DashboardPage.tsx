import { Fragment, useMemo } from "react"
import { Check, Plus } from "lucide-react"
import { useTasks, useUpdateTask } from "@/api/kanban"
import { useUI } from "@/components/ui-provider"
import { useQuickCreate } from "@/hooks/useQuickCreate"
import { TaskCard } from "@/components/task/TaskCard"
import MiniCalendar from "@/components/dashboard/MiniCalendar"
import NoDueQueue from "@/components/dashboard/NoDueQueue"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { todayUtcMs, utcDayMs } from "@/lib/dates"
import type { Task } from "@/types"

type SectionKey = "overdue" | "today" | "next3" | "next7" | "next14" | "next30"

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "next3", label: "Next 3 days" },
  { key: "next7", label: "Next 7 days" },
  { key: "next14", label: "Next 14 days" },
  { key: "next30", label: "Next 30 days" },
]

function TimelineRow({
  task,
  isLast,
  dimmed,
  onClick,
}: {
  task: Task
  isLast: boolean
  dimmed: boolean
  onClick: () => void
}) {
  const color = task.expand?.project?.color ?? "#64748b"
  const updateTask = useUpdateTask()
  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 py-2.5 transition-opacity hover:bg-accent/50",
        dimmed && "opacity-40"
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[3px] rounded-r-full"
        style={{ backgroundColor: color }}
      />
      <span
        data-testid="timeline-dot"
        className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-card"
        style={{ backgroundColor: color }}
      />
      {!isLast && (
        <span
          data-testid="timeline-connector"
          className="pointer-events-none absolute bottom-[-1px] left-[21px] top-3 w-px bg-border"
        />
      )}
      <TaskCard bare task={task} onClick={onClick} showProject />
      <button
        type="button"
        data-testid="complete-task"
        title="Mark as done"
        onClick={(e) => {
          e.stopPropagation()
          updateTask.mutate({ id: task.id, data: { status: "done" } })
        }}
        className="self-center rounded-full border bg-background p-1.5 text-emerald-500 opacity-0 shadow-sm transition-opacity hover:bg-emerald-500 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function Section({
  tasks,
  hoveredDay,
  onClick,
}: {
  tasks: Task[]
  hoveredDay: number | null
  onClick: (id: string) => void
}) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border bg-card">
      {tasks.map((t, i) => (
        <TimelineRow
          key={t.id}
          task={t}
          isLast={i === tasks.length - 1}
          dimmed={hoveredDay !== null && utcDayMs(t.dueDate) !== hoveredDay}
          onClick={() => onClick(t.id)}
        />
      ))}
    </div>
  )
}

function SectionBlock({
  testKey,
  title,
  count,
  dimmed,
  children,
}: {
  testKey: string
  title: string
  count: number
  dimmed: boolean
  children: React.ReactNode
}) {
  return (
    <section data-testid={`section-${testKey}`} className="py-5 first:pt-0 last:pb-0">
      <span
        data-testid={`section-header-${testKey}`}
        className={cn(
          "mb-2 flex w-full items-center gap-2 transition-opacity",
          dimmed && "opacity-40"
        )}
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        <span
          data-testid={`section-count-${testKey}`}
          className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {count}
        </span>
      </span>
      {children}
    </section>
  )
}

export default function DashboardPage() {
  const { data: tasks = [] } = useTasks()
  const { openTask, hoveredDay } = useUI()
  const quickCreate = useQuickCreate()

  const buckets = useMemo(() => {
    const today = todayUtcMs()
    const day = 86_400_000
    const in3 = today + 3 * day
    const in7 = today + 7 * day
    const in14 = today + 14 * day
    const in30 = today + 30 * day
    const b: Record<SectionKey, Task[]> = {
      overdue: [],
      today: [],
      next3: [],
      next7: [],
      next14: [],
      next30: [],
    }
    for (const t of tasks) {
      // Completed tasks don't belong on the dashboard timeline; they live in
      // the Done column on their project board.
      if (t.status === "done") continue
      const due = utcDayMs(t.dueDate)
      // Tasks without due dates (and ones scheduled more than 30 days out)
      // stay on their project board only.
      if (due === null) continue
      let key: SectionKey | null = null
      if (due < today) key = "overdue"
      else if (due === today) key = "today"
      else if (due < in3) key = "next3"
      else if (due < in7) key = "next7"
      else if (due < in14) key = "next14"
      else if (due < in30) key = "next30"
      if (key === null) continue
      b[key].push(t)
    }
    for (const k of Object.keys(b) as SectionKey[]) {
      b[k].sort(
        (a, c) =>
          new Date(a.dueDate).getTime() - new Date(c.dueDate).getTime() ||
          a.status.localeCompare(c.status)
      )
    }
    return b
  }, [tasks])

  const visible = useMemo(() => {
    const blocks: {
      key: string
      title: string
      count: number
      headerDimmed: boolean
      content: React.ReactNode
    }[] = []
    for (const s of SECTIONS) {
      const tasksInSection = buckets[s.key]
      if (tasksInSection.length === 0) continue
      blocks.push({
        key: s.key,
        title: s.label,
        count: tasksInSection.length,
        headerDimmed:
          hoveredDay !== null && !tasksInSection.some((t) => utcDayMs(t.dueDate) === hoveredDay),
        content: (
          <Section tasks={tasksInSection} hoveredDay={hoveredDay} onClick={(id) => openTask(id)} />
        ),
      })
    }
    return blocks
  }, [buckets, openTask, hoveredDay])

  const queueCount = useMemo(
    () => tasks.filter((t) => t.queued && t.status !== "done" && utcDayMs(t.dueDate) === null).length,
    [tasks]
  )

  const hasContent = visible.length > 0 || queueCount > 0

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-base font-semibold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            {tasks.length} task{tasks.length === 1 ? "" : "s"} across all projects
          </p>
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={() => void quickCreate(null, "todo")}>
          <Plus className="h-4 w-4" /> New task
        </Button>
      </header>

      <div className="mx-auto flex max-w-6xl items-start gap-6 px-4 py-5">
        <div className="min-w-0 flex-1">
          {!hasContent ? (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No tasks yet. Create one with the "New task" button above.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {visible.map((b, i) => (
                <Fragment key={b.key}>
                  <SectionBlock
                    testKey={b.key}
                    title={b.title}
                    count={b.count}
                    dimmed={b.headerDimmed}
                  >
                    {b.content}
                  </SectionBlock>
                  {b.key === "overdue" && i < visible.length - 1 && (
                    <div data-testid="overdue-separator" className="py-3">
                      <div className="border-t-2 border-dashed border-border" />
                    </div>
                  )}
                </Fragment>
              ))}
              {visible.length > 0 && (
                <div data-testid="queue-separator" className="py-3">
                  <div className="border-t-2 border-dashed border-border" />
                </div>
              )}
              <NoDueQueue onOpen={openTask} />
            </div>
          )}
        </div>
        <div className="sticky top-[4.5rem] hidden w-64 shrink-0 lg:block">
          <MiniCalendar />
        </div>
      </div>
    </div>
  )
}
