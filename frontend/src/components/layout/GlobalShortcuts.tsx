import { useEffect } from "react"
import { useUI } from "@/components/ui-provider"
import { useQuickCreate } from "@/hooks/useQuickCreate"

export default function GlobalShortcuts({ defaultProjectId }: { defaultProjectId: string | null }) {
  const quickCreate = useQuickCreate()
  const { quickCreate: activeQuickCreate } = useUI()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        // Never replace an open editor: that would silently discard its draft.
        if (activeQuickCreate) return
        void quickCreate(defaultProjectId, "todo")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [quickCreate, defaultProjectId, activeQuickCreate])

  return null
}
