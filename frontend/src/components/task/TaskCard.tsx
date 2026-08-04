import { CalendarDays, ListChecks, MessageSquare, Paperclip } from "lucide-react"
import type { Task } from "@/types"
import { cn } from "@/lib/utils"
import { todayUtcMs, utcDayMs, utcMonthDayTime } from "@/lib/dates"
import { useChecklistStats, useCommentCounts } from "@/api/kanban"
import { LabelBadge } from "@/components/task/LabelBadge"

export function TaskCard({
  task,
  onClick,
  showProject,
  bare,
}: {
  task: Task
  onClick?: () => void
  showProject?: boolean
  bare?: boolean
}) {
  const { data: commentCounts } = useCommentCounts()
  const { data: checklistStats } = useChecklistStats()
  const dueDay = utcDayMs(task.dueDate)
  const overdue = dueDay !== null && dueDay < todayUtcMs()
  const project = task.expand?.project
  const labels = task.expand?.labels ?? []
  const comments = commentCounts?.get(task.id) ?? 0
  const checklist = checklistStats?.get(task.id)
  const checklistPct =
    checklist && checklist.total > 0 ? Math.round((checklist.done / checklist.total) * 100) : null

  const meta = (
    <>
      {showProject && project && (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: project.color || "#64748b" }}
          />
          <span className="truncate">{project.name}</span>
        </span>
      )}
      {dueDay !== null && (
        <span
          className={cn(
            "inline-flex items-center gap-1",
            overdue && "font-medium text-red-400"
          )}
        >
          <CalendarDays className="h-3 w-3" />
          {utcMonthDayTime(task.dueDate)}
        </span>
      )}
      {checklist && checklist.total > 0 && (
        <span data-testid="checklist-progress" className="inline-flex items-center gap-1">
          <ListChecks className="h-3 w-3" />
          {checklist.done}/{checklist.total}
        </span>
      )}
      {task.attachments.length > 0 && (
        <span data-testid="attachment-count" className="inline-flex items-center gap-1" title="Has attachments">
          <Paperclip className="h-3 w-3" />
          {task.attachments.length}
        </span>
      )}
      {comments > 0 && (
        <span data-testid="comment-count" className="inline-flex items-center gap-1" title="Has comments">
          <MessageSquare className="h-3 w-3" />
          {comments}
        </span>
      )}
    </>
  )

  if (bare) {
    return (
      <button
        type="button"
        data-testid="task-card"
        onClick={onClick}
        className="min-w-0 flex-1 py-0.5 text-left"
      >
        {checklistPct !== null && (
          <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${checklistPct}%` }}
            />
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium leading-snug">{task.title}</div>
            {task.description && (
              <div className="truncate text-xs text-muted-foreground">{task.description}</div>
            )}
            {labels.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {labels.map((l) => (
                  <LabelBadge key={l.id} label={l} />
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {meta}
          </div>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      data-testid="task-card"
      onClick={onClick}
      className={cn(
        "w-full cursor-pointer text-left rounded-md border bg-card p-3 shadow-sm transition-colors hover:border-foreground/20 hover:shadow-md"
      )}
    >
      {checklistPct !== null && (
        <div
          className={cn("mb-1.5 h-1 overflow-hidden rounded-full bg-muted", !bare && "w-full")}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${checklistPct}%` }}
          />
        </div>
      )}
      <div className="text-sm font-medium leading-snug line-clamp-2">{task.title}</div>
      {task.description && (
        <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
          {task.description}
        </div>
      )}
      {labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {labels.map((l) => (
            <LabelBadge key={l.id} label={l} />
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {meta}
      </div>
    </button>
  )
}
