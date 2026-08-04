import { Link, Outlet, useLocation } from "@tanstack/react-router"
import { LayoutDashboard, Settings } from "lucide-react"
import { useProjects } from "@/api/kanban"
import { UIProvider } from "@/components/ui-provider"
import { ToastProvider } from "@/components/ui/toast"
import Sidebar from "@/components/layout/Sidebar"
import SearchBar from "@/components/layout/SearchBar"
import GlobalShortcuts from "@/components/layout/GlobalShortcuts"
import TaskDrawer from "@/components/task/TaskDrawer"
import QuickCreate from "@/components/task/QuickCreate"

function MobileHeader() {
  const { data: projects = [] } = useProjects()
  return (
    <header className="flex flex-col gap-2 border-b bg-background px-3 py-2 md:hidden">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          K
        </div>
        <div className="min-w-0 flex-1">
          <SearchBar />
        </div>
        <Link to="/" className="p-1.5 text-muted-foreground" aria-label="Dashboard">
          <LayoutDashboard className="h-5 w-5" />
        </Link>
        <Link to="/settings" className="p-1.5 text-muted-foreground" aria-label="Settings">
          <Settings className="h-5 w-5" />
        </Link>
      </div>
      {projects.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || "#64748b" }} />
              {p.name}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}

export default function RootLayout() {
  const location = useLocation()
  const m = location.pathname.match(/^\/projects\/([^/]+)/)
  const defaultProjectId = m ? m[1] : null

  return (
    <ToastProvider>
      <UIProvider>
        <GlobalShortcuts defaultProjectId={defaultProjectId} />
        <div className="flex h-dvh w-full flex-col md:flex-row">
          <MobileHeader />
          <Sidebar />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Outlet />
          </main>
        </div>
        <TaskDrawer />
        <QuickCreate />
      </UIProvider>
    </ToastProvider>
  )
}
