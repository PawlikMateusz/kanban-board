import { useMemo } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useLabels, useTasks } from "@/api/kanban"
import { useUI } from "@/components/ui-provider"
import { TaskCard } from "@/components/task/TaskCard"
import { Button } from "@/components/ui/button"
import type { Task } from "@/types"

function Row({ task, onClick }: { task: Task; onClick: () => void }) {
  const color = task.expand?.project?.color ?? "#64748b"
  return (
    <div className="group relative flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50">
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
      <TaskCard bare task={task} onClick={onClick} showProject />
    </div>
  )
}

export default function LabelsPage() {
  const { labelId } = useParams({ strict: false })
  const { data: labels = [] } = useLabels()
  const { data: tasks = [] } = useTasks()
  const { openTask } = useUI()

  const label = labels.find((l) => l.id === labelId)

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => (t.labels ?? []).includes(labelId ?? ""))
      .sort(
        (a, b) =>
          (a.expand?.project?.name ?? "").localeCompare(b.expand?.project?.name ?? "") ||
          a.created.localeCompare(b.created)
      )
  }, [tasks, labelId])

  if (!label) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>Label not found.</p>
        <Button variant="outline" asChild>
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center gap-3 border-b bg-background px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground md:hidden" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: label.color || "#64748b" }}
        />
        <h1 className="text-base font-semibold">{label.name}</h1>
        <span className="text-xs text-muted-foreground">
          {filtered.length} task{filtered.length === 1 ? "" : "s"}
        </span>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-5">
        {filtered.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No tasks with this label.</p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border bg-card">
            {filtered.map((t) => (
              <Row key={t.id} task={t} onClick={() => openTask(t.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
