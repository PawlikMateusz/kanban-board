import { AlertTriangle, BellPlus, CalendarClock, Loader2, X } from "lucide-react"
import { useCalDavConfig, useRemoveFromCalendar, useSendToCalendar } from "@/api/kanban"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Task } from "@/types"

/** Wall-clock "YYYY-MM-DD HH:mm" of a stored due-date value, so values that
 *  differ only in T/space separator or milliseconds still compare equal. */
function dueWall(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : ""
}

/**
 * Pushes a due-dated task to a Radicale CalDAV calendar so it appears as a
 * reminder on the iPhone. Only the due date is synced (there are no reminder
 * offsets). When the card's due date has changed since the last sync, the
 * controls switch to a warning style to prompt re-syncing. Hidden entirely when
 * CalDAV is not configured on the backend (RADICALE_* env vars missing).
 */
export default function CalendarSync({ task }: { task: Task }) {
  const { data: enabled } = useCalDavConfig()
  const sendToCalendar = useSendToCalendar()
  const removeFromCalendar = useRemoveFromCalendar()

  const synced = !!task.caldavUrl
  const hasDue = !!task.dueDate
  // Drifted when the current due date differs from what was last synced (this
  // also flags legacy synced tasks that predate the caldavDueDate field, and a
  // cleared due date).
  const outOfSync = synced && dueWall(task.dueDate) !== dueWall(task.caldavDueDate ?? "")

  // Nothing to show when the feature is disabled, or the task neither has a
  // due date nor a previously synced entry (which may need removing).
  if (!enabled) return null
  if (!hasDue && !synced) return null

  return (
    <div data-testid="caldav-section">
      <p className="mb-1.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" /> iPhone reminders
      </p>

      <div className="flex items-center gap-2">
        {hasDue && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "flex-1",
              outOfSync &&
                "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
            )}
            data-testid="caldav-sync"
            title={
              outOfSync
                ? "Due date changed since the last sync — click to update"
                : "Sync the due date to your Radicale calendar"
            }
            onClick={() => sendToCalendar.mutate({ taskId: task.id })}
          >
            {sendToCalendar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : outOfSync ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <BellPlus className="h-4 w-4" />
            )}
            {synced ? "Update in calendar" : "Send to calendar"}
          </Button>
        )}

        {synced && (
          <Badge
            variant="outline"
            data-testid={outOfSync ? "caldav-outofsync" : "caldav-synced"}
            className={cn(
              "shrink-0",
              outOfSync
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-emerald-300 text-emerald-700"
            )}
            title={
              outOfSync
                ? "Due date changed since the last sync"
                : "Synced to your Radicale calendar"
            }
          >
            {outOfSync ? "Out of sync" : "Synced"}
          </Badge>
        )}

        {synced && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            data-testid="caldav-remove"
            title="Remove from calendar"
            aria-label="Remove from calendar"
            onClick={() => removeFromCalendar.mutate(task.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
