import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTasks } from "@/api/kanban"
import { useUI } from "@/components/ui-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { todayUtcMs, utcDayMs } from "@/lib/dates"
import type { Task } from "@/types"

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function utcDate(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d))
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Compact month overview: highlights today and dots the days that have tasks
 *  with a due date. Hovering a day highlights it so the dashboard timeline can
 *  focus the rows due that day. */
export default function MiniCalendar() {
  const { data: tasks = [] } = useTasks()
  const { setHoveredDay } = useUI()
  const [view, setView] = useState(() => {
    const n = new Date()
    return utcDate(n.getUTCFullYear(), n.getUTCMonth() + 1, 1)
  })

  const viewY = view.getUTCFullYear()
  const viewM = view.getUTCMonth() + 1
  const firstWeekday = (utcDate(viewY, viewM, 1).getUTCDay() + 6) % 7 // Monday = 0
  const daysInMonth = utcDate(viewY, viewM + 1, 0).getUTCDate()
  const today = todayUtcMs()
  const iso = (d: number) => `${viewY}-${pad(viewM)}-${pad(d)}`

  const dueByDay = useMemo(() => {
    const map = new Map<number, Task[]>()
    for (const t of tasks) {
      if (t.status === "done") continue
      const ms = utcDayMs(t.dueDate)
      if (ms == null) continue
      const arr = map.get(ms) ?? []
      arr.push(t)
      map.set(ms, arr)
    }
    return map
  }, [tasks])

  return (
    <div data-testid="mini-calendar" className="w-full rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {MONTHS[viewM - 1]} {viewY}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            data-testid="cal-prev-month"
            title="Previous month"
            className="h-6 w-6"
            onClick={() => setView(utcDate(viewY, viewM - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            data-testid="cal-next-month"
            title="Next month"
            className="h-6 w-6"
            onClick={() => setView(utcDate(viewY, viewM + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-xs">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 text-muted-foreground">
            {w}
          </span>
        ))}
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <span key={`blank-${i}`} className="h-8" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1
          const ms = utcDate(viewY, viewM, d).getTime()
          const isToday = ms === today
          const dayTasks = dueByDay.get(ms) ?? []
          const inPast = ms < today
          return (
            <div
              key={d}
              data-testid={`cal-day-${iso(d)}`}
              title={dayTasks.length > 0 ? dayTasks.map((t) => t.title).join(" · ") : undefined}
              onMouseEnter={() => setHoveredDay(ms)}
              onMouseLeave={() => setHoveredDay(null)}
              className={cn(
                "flex h-8 flex-col items-center justify-center rounded transition-colors hover:bg-accent",
                isToday && "bg-primary font-semibold text-primary-foreground",
                !isToday && dayTasks.length > 0 && "bg-accent/60",
                inPast && !isToday && "text-muted-foreground"
              )}
            >
              <span className="leading-none">{d}</span>
              <span className="mt-1 flex h-1.5 items-center gap-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <span
                    key={t.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: t.expand?.project?.color ?? "#64748b" }}
                  />
                ))}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
