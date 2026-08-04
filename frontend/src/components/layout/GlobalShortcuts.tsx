import { useEffect } from "react"
import { useQuickCreate } from "@/hooks/useQuickCreate"

export default function GlobalShortcuts({ defaultProjectId }: { defaultProjectId: string | null }) {
  const quickCreate = useQuickCreate()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        void quickCreate(defaultProjectId, "todo")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [quickCreate, defaultProjectId])

  return null
}
