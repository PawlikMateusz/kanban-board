import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { TaskStatus } from "@/types"

type QuickCreate = {
  taskId: string
  projectId: string
  status: TaskStatus
}

type UIContextValue = {
  activeTaskId: string | null
  openTask: (id: string) => void
  closeTask: () => void
  quickCreate: QuickCreate | null
  openQuickCreate: (taskId: string, projectId: string, status: TaskStatus) => void
  closeQuickCreate: () => void
  hoveredDay: number | null
  setHoveredDay: (ms: number | null) => void
}

const UIContext = createContext<UIContextValue | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [quickCreate, setQuickCreate] = useState<QuickCreate | null>(null)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  const value = useMemo<UIContextValue>(
    () => ({
      activeTaskId,
      openTask: setActiveTaskId,
      closeTask: () => setActiveTaskId(null),
      quickCreate,
      openQuickCreate: (taskId, projectId, status) => setQuickCreate({ taskId, projectId, status }),
      closeQuickCreate: () => setQuickCreate(null),
      hoveredDay,
      setHoveredDay,
    }),
    [activeTaskId, quickCreate, hoveredDay]
  )

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error("useUI must be used within UIProvider")
  return ctx
}
