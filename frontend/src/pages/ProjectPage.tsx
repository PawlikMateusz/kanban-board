import { useMemo } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { ArrowLeft, Plus } from "lucide-react"
import { useProjects, useTasks } from "@/api/kanban"
import { useUI } from "@/components/ui-provider"
import { useQuickCreate } from "@/hooks/useQuickCreate"
import { Board } from "@/components/board/Board"
import { Button } from "@/components/ui/button"
import { STATUSES, type Task, type TaskStatus } from "@/types"

export default function ProjectPage() {
  const { projectId } = useParams({ strict: false })
  const { data: projects = [] } = useProjects()
  const { data: tasks = [] } = useTasks()
  const { openTask } = useUI()
  const quickCreate = useQuickCreate()
  const project = projects.find((p) => p.id === projectId)

  const columns = useMemo(() => {
    const c: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] }
    for (const t of tasks) {
      if (t.project === projectId) c[t.status].push(t)
    }
    for (const k of STATUSES) {
      c[k.value].sort((a, b) => a.order - b.order || a.created.localeCompare(b.created))
    }
    return c
  }, [tasks, projectId])

  if (!project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>Project not found.</p>
        <Button variant="outline" asChild>
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b bg-background px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground md:hidden" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: project.color || "#64748b" }}
        />
        <h1 className="text-base font-semibold">{project.name}</h1>
        <span className="text-xs text-muted-foreground">
          {tasks.filter((t) => t.project === projectId).length} tasks
        </span>
        <div className="flex-1" />
        <Button size="sm" onClick={() => void quickCreate(project.id, "todo")}>
          <Plus className="h-4 w-4" /> New task
        </Button>
      </header>
      <div className="min-h-0 flex-1 py-4">
        <Board
          columns={columns}
          onOpenTask={openTask}
          onAddTask={(status) => void quickCreate(project.id, status)}
        />
      </div>
    </div>
  )
}
