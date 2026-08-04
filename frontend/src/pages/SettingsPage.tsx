import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
  ORDER_GAP,
  useCreateLabel,
  useCreateProject,
  useDeleteLabel,
  useDeleteProject,
  useLabels,
  useProjects,
  useUpdateLabel,
  useUpdateProject,
} from "@/api/kanban"
import ColorPicker from "@/components/ColorPicker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

function ConfirmDeleteDialog({
  open,
  title,
  message,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{message}</p>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProjectManager() {
  const { data: projects = [] } = useProjects()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const [name, setName] = useState("")
  const [color, setColor] = useState("#6366f1")
  const [confirmId, setConfirmId] = useState<string | null>(null)

  function add() {
    const n = name.trim()
    if (!n) return
    const order = projects.reduce((m, p) => Math.max(m, p.order ?? 0), 0) + ORDER_GAP
    createProject.mutate({ name: n, color, order })
    setName("")
  }

  const toDelete = projects.find((p) => p.id === confirmId) ?? null

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Projects</h2>
      <div className="mb-4 flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Project name"
          className="flex-1"
        />
        <ColorPicker value={color} onChange={setColor} />
        <Button onClick={add} disabled={!name.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
            <ColorPicker
              value={p.color}
              onChange={(c) => updateProject.mutate({ id: p.id, data: { color: c } })}
            />
            <Input
              defaultValue={p.name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== p.name) updateProject.mutate({ id: p.id, data: { name: v } })
              }}
              className="h-8 flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              title="Delete project"
              onClick={() => setConfirmId(p.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {projects.length === 0 && <p className="text-xs text-muted-foreground">No projects yet.</p>}
      </div>

      <ConfirmDeleteDialog
        open={!!confirmId}
        title="Delete project"
        message={`This will permanently delete “${toDelete?.name ?? "project"}” and all of its tasks and comments. This action cannot be undone.`}
        onConfirm={() => {
          if (confirmId) deleteProject.mutate(confirmId)
          setConfirmId(null)
        }}
        onClose={() => setConfirmId(null)}
      />
    </section>
  )
}

function LabelManager() {
  const { data: labels = [] } = useLabels()
  const createLabel = useCreateLabel()
  const updateLabel = useUpdateLabel()
  const deleteLabel = useDeleteLabel()

  const [name, setName] = useState("")
  const [color, setColor] = useState("#f59e0b")
  const [confirmId, setConfirmId] = useState<string | null>(null)

  function add() {
    const n = name.trim()
    if (!n) return
    createLabel.mutate({ name: n, color })
    setName("")
  }

  const toDelete = labels.find((l) => l.id === confirmId) ?? null

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Labels</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Labels are global and reusable across projects.
      </p>
      <div className="mb-4 flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Label name"
          className="flex-1"
        />
        <ColorPicker value={color} onChange={setColor} />
        <Button onClick={add} disabled={!name.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {labels.map((l) => (
          <div key={l.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
            <ColorPicker
              value={l.color}
              onChange={(c) => updateLabel.mutate({ id: l.id, data: { color: c } })}
            />
            <Input
              defaultValue={l.name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== l.name) updateLabel.mutate({ id: l.id, data: { name: v } })
              }}
              className="h-8 flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              title="Delete label"
              onClick={() => setConfirmId(l.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {labels.length === 0 && <p className="text-xs text-muted-foreground">No labels yet.</p>}
      </div>

      <ConfirmDeleteDialog
        open={!!confirmId}
        title="Delete label"
        message={`This will remove “${toDelete?.name ?? "label"}” from all tasks. This action cannot be undone.`}
        onConfirm={() => {
          if (confirmId) deleteLabel.mutate(confirmId)
          setConfirmId(null)
        }}
        onClose={() => setConfirmId(null)}
      />
    </section>
  )
}

export default function SettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-b bg-background px-4 py-3">
        <h1 className="text-base font-semibold">Settings</h1>
        <p className="text-xs text-muted-foreground">Manage projects and labels.</p>
      </header>
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-5 md:grid-cols-2">
        <ProjectManager />
        <LabelManager />
      </div>
    </div>
  )
}
