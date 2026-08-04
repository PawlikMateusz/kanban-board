import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const PRESETS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#78716c",
  "#111827",
]

export default function ColorPicker({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (c: string) => void
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("h-9 w-9 shrink-0 rounded-md border shadow-sm", className)}
          style={{ backgroundColor: value || "#64748b" }}
          aria-label="Pick color"
        />
      </PopoverTrigger>
      <PopoverContent className="w-60" align="start">
        <div className="grid grid-cols-6 gap-1.5">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={cn(
                "h-7 w-7 rounded-full border transition-transform hover:scale-110",
                value === c && "ring-2 ring-ring ring-offset-2"
              )}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>
        <div className="mt-3">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#6366f1"
            className="h-8"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
