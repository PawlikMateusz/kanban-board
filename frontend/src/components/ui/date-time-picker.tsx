import { useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Default due time applied when picking a date without an existing value. */
const DEFAULT_HOUR = 18

/** Quick-set time suggestions shown in the picker. */
const SUGGESTED_HOURS = [9, 12, 15, 18, 21]

/** Builds a Date whose UTC components equal the given values (dates are
 *  treated as UTC to match the rest of the app). */
function utcDate(y: number, m: number, d: number, h = 0, min = 0) {
  return new Date(Date.UTC(y, m - 1, d, h, min))
}

/** Parses the stored ISO value into a Date (UTC). */
function parseValue(iso: string): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

/** Wraps a Date so its UTC components read as local ones, letting date-fns
 *  format them without timezone drift. */
function asLocal(d: Date) {
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes()
  )
}

export function DateTimePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (iso: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const current = parseValue(value)

  const today = new Date()
  const todayUtc = utcDate(
    today.getUTCFullYear(),
    today.getUTCMonth() + 1,
    today.getUTCDate()
  )
  const base = current ?? utcDate(
    today.getUTCFullYear(),
    today.getUTCMonth() + 1,
    today.getUTCDate(),
    DEFAULT_HOUR
  )

  const [view, setView] = useState(() => utcDate(base.getUTCFullYear(), base.getUTCMonth() + 1, 1))

  const viewY = view.getUTCFullYear()
  const viewM = view.getUTCMonth() + 1
  const firstWeekday = (utcDate(viewY, viewM, 1).getUTCDay() + 6) % 7 // Monday = 0
  const daysInMonth = utcDate(viewY, viewM + 1, 0).getUTCDate()

  const curY = current?.getUTCFullYear()
  const curM = current?.getUTCMonth()
  const curD = current?.getUTCDate()
  const curH = current?.getUTCHours() ?? DEFAULT_HOUR
  const curMin = current?.getUTCMinutes() ?? 0

  function setDate(d: number) {
    onChange(utcDate(viewY, viewM, d, base.getUTCHours(), base.getUTCMinutes()).toISOString())
  }

  function setTime(h: number, min: number) {
    onChange(
      utcDate(
        base.getUTCFullYear(),
        base.getUTCMonth() + 1,
        base.getUTCDate(),
        h,
        min
      ).toISOString()
    )
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 60 }, (_, i) => i)
  const iso = (d: number) => `${viewY}-${pad(viewM)}-${pad(d)}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="due-date-trigger"
          className="w-full justify-start gap-2 text-sm font-normal"
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {current ? format(asLocal(current), "MMM d, HH:mm") : "Set due date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {MONTHS[viewM - 1]} {viewY}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              data-testid="dp-prev-month"
              title="Previous month"
              className="h-7 w-7"
              onClick={() => setView(utcDate(viewY, viewM - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              data-testid="dp-next-month"
              title="Next month"
              className="h-7 w-7"
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
            <span key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1
            const selected = curD === d && curY === viewY && curM === viewM - 1
            const isToday = todayUtc.getTime() === utcDate(viewY, viewM, d).getTime()
            return (
              <button
                key={d}
                type="button"
                data-testid={`dp-day-${iso(d)}`}
                onClick={() => setDate(d)}
                className={cn(
                  "h-7 w-7 rounded text-xs transition-colors hover:bg-accent",
                  isToday && "bg-accent/60 font-semibold text-primary",
                  selected && "bg-primary text-primary-foreground hover:bg-primary"
                )}
              >
                {d}
              </button>
            )
          })}
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {SUGGESTED_HOURS.map((h) => {
                const active = curH === h && curMin === 0
                return (
                  <button
                    key={h}
                    type="button"
                    data-testid={`dp-time-${h}`}
                    onClick={() => setTime(h, 0)}
                    className={cn(
                      "h-7 rounded-md border px-2 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary font-medium text-primary-foreground hover:bg-primary"
                        : "border-input hover:bg-accent"
                    )}
                  >
                    {h}:00
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-1">
              {current && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    onChange("")
                    setOpen(false)
                  }}
                >
                  Clear
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  setDate(todayUtc.getUTCDate())
                  setView(utcDate(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() + 1, 1))
                }}
              >
                Today
              </Button>
            </div>
          </div>
          {showCustom ? (
            <div className="flex items-center gap-1.5">
              <select
                data-testid="dp-hour"
                value={curH}
                onChange={(e) => setTime(Number(e.target.value), curMin)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {pad(h)}
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">:</span>
              <select
                data-testid="dp-minute"
                value={curMin}
                onChange={(e) => setTime(curH, Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>
                    {pad(m)}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setShowCustom(false)}
              >
                Done
              </Button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="dp-custom-time"
              onClick={() => setShowCustom(true)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Custom time…
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
