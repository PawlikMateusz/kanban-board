import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useSettings, useUpdateSettings } from "@/api/kanban"
import type { TaskStatus, Theme } from "@/types"

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
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const UIContext = createContext<UIContextValue | null>(null)

function initialTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [quickCreate, setQuickCreate] = useState<QuickCreate | null>(null)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  // The server is the source of truth for the theme (so it follows the user
  // across devices). localStorage is only a cache for the instant initial paint.
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const syncedRef = useRef(false)
  const changedRef = useRef(false)

  useEffect(() => {
    if (!settings || syncedRef.current) return
    syncedRef.current = true
    if (!changedRef.current) setThemeState(settings.theme)
  }, [settings])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    try {
      localStorage.setItem("kanban-theme", theme)
    } catch {
      // Storage may be unavailable; the theme still applies for this session.
    }
  }, [theme])

  function setTheme(next: Theme) {
    if (next === theme) return
    changedRef.current = true
    setThemeState(next)
    updateSettings.mutate({ theme: next })
  }

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
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTaskId, quickCreate, hoveredDay, theme]
  )

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error("useUI must be used within UIProvider")
  return ctx
}
