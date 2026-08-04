import { useState } from "react"
import { Check, Plus, Search, Tag } from "lucide-react"
import { useCreateLabel, useLabels, useUpdateTask } from "@/api/kanban"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Task } from "@/types"

export default function LabelPicker({ task }: { task: Task }) {
  const { data: labels = [] } = useLabels()
  const updateTask = useUpdateTask()
  const createLabel = useCreateLabel()
  const [query, setQuery] = useState("")
  const selected = task.labels ?? []

  const q = query.trim().toLowerCase()
  const matches = q ? labels.filter((l) => l.name.toLowerCase().includes(q)) : labels
  const exactMatch = labels.find((l) => l.name.toLowerCase() === q)

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    updateTask.mutate({ id: task.id, data: { labels: next } })
  }

  async function addLabel(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const existing = labels.find((l) => l.name.toLowerCase() === trimmed.toLowerCase())
    const id =
      existing?.id ?? (await createLabel.mutateAsync({ name: trimmed, color: "#6366f1" })).id
    if (!selected.includes(id)) {
      updateTask.mutate({ id: task.id, data: { labels: [...selected, id] } })
    }
    setQuery("")
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Add labels"
          title="Add labels"
          data-testid="drawer-labels"
        >
          <Tag className="h-4 w-4" />
          {selected.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold leading-none text-primary-foreground">
              {selected.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                if (q && !exactMatch) void addLabel(query.trim())
              }
            }}
            placeholder="Search or create label…"
            className="h-8 pl-7 pr-2 text-xs"
          />
        </div>
        <div className="mt-1 max-h-48 overflow-y-auto">
          {matches.length === 0 && !q && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No labels yet. Type a name to create one.
            </p>
          )}
          {matches.map((l) => (
            <button
              key={l.id}
              onClick={() => toggle(l.id)}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: l.color || "#64748b" }}
                />
                <span className="truncate">{l.name}</span>
              </span>
              {selected.includes(l.id) && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
          {q && !exactMatch && (
            <button
              onClick={() => void addLabel(query.trim())}
              className="mt-1 flex w-full items-center gap-2 rounded border-t px-2 py-1.5 text-left text-sm font-medium text-primary hover:bg-accent"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">Create "{query.trim()}"</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
