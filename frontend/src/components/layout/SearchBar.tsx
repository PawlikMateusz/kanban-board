import { useEffect, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { useSearchTasks } from "@/api/kanban"
import { useUI } from "@/components/ui-provider"
import { Input } from "@/components/ui/input"

export default function SearchBar() {
  const [q, setQ] = useState("")
  const [debounced, setDebounced] = useState("")
  const [open, setOpen] = useState(false)
  const { openTask } = useUI()

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200)
    return () => clearTimeout(t)
  }, [q])

  const query = debounced.trim()
  const enabled = query.length >= 2
  const { data: results = [], isFetching } = useSearchTasks(query, enabled)

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search tasks…"
        className="pl-8"
      />
      {open && q.trim().length > 0 && (
        <div data-testid="search-results" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {!enabled && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Type at least 2 characters…</p>
          )}
          {enabled && isFetching && results.length === 0 && (
            <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching…
            </p>
          )}
          {enabled && !isFetching && results.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No results.</p>
          )}
          {results.map((t) => (
            <button
              key={t.id}
              onMouseDown={() => {
                openTask(t.id)
                setQ("")
                setOpen(false)
              }}
              className="flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left hover:bg-accent"
            >
              <span className="text-[11px] text-muted-foreground">{t.expand?.project?.name}</span>
              <span className="truncate text-sm">{t.title || "Untitled"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
