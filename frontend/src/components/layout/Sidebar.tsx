import { useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronRight, GripVertical, LayoutDashboard, Settings } from "lucide-react"
import type { ReactNode } from "react"
import { ORDER_GAP, useLabels, useProjects, useReorderProjects } from "@/api/kanban"
import SearchBar from "@/components/layout/SearchBar"
import { cn } from "@/lib/utils"
import type { Project } from "@/types"

function SidebarLink({
  to,
  params,
  children,
}: {
  to: "/" | "/settings" | "/projects/$projectId" | "/labels/$labelId"
  params?: { projectId?: string; labelId?: string }
  children: ReactNode
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const target =
    to === "/projects/$projectId"
      ? `/projects/${params?.projectId}`
      : to === "/labels/$labelId"
        ? `/labels/${params?.labelId}`
        : to
  const active = pathname === target || (target !== "/" && pathname.startsWith(target))
  return (
    <Link
      to={to}
      params={params}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-foreground/75 hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent font-medium text-accent-foreground"
      )}
    >
      {children}
    </Link>
  )
}

function SortableProject({ project }: { project: Project }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center rounded-md", isDragging && "opacity-40")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${project.name}`}
        className="shrink-0 cursor-grab touch-none p-1 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <SidebarLink to="/projects/$projectId" params={{ projectId: project.id }}>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: project.color || "#64748b" }}
        />
        <span className="truncate">{project.name}</span>
      </SidebarLink>
    </div>
  )
}

function ProjectList() {
  const { data: projects = [] } = useProjects()
  const reorderProjects = useReorderProjects()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = projects.findIndex((p) => p.id === active.id)
    const newIndex = projects.findIndex((p) => p.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(projects, oldIndex, newIndex)
    reorderProjects.mutate(next.map((p, i) => ({ id: p.id, order: (i + 1) * ORDER_GAP })))
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-1 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {projects.map((p) => (
            <SortableProject key={p.id} project={p} />
          ))}
          {projects.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">No projects yet.</p>
          )}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function LabelsNav() {
  const { data: labels = [] } = useLabels()
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 px-2 py-1 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
        />
        Labels
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 px-3">
          {labels.map((l) => (
            <SidebarLink key={l.id} to="/labels/$labelId" params={{ labelId: l.id }}>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: l.color || "#64748b" }}
              />
              <span className="truncate">{l.name}</span>
            </SidebarLink>
          ))}
          {labels.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">No labels yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-background md:flex">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          K
        </div>
        <span className="text-lg font-semibold tracking-tight">Kanban</span>
      </div>

      <div className="px-3">
        <SearchBar />
      </div>

      <nav className="mt-3 flex flex-col gap-0.5 px-3">
        <SidebarLink to="/">
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </SidebarLink>
        <SidebarLink to="/settings">
          <Settings className="h-4 w-4" /> Settings
        </SidebarLink>
      </nav>

      <LabelsNav />

      <div className="mt-4 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Projects
      </div>
      <ProjectList />
    </aside>
  )
}
