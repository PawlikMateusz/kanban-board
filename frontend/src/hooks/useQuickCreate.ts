import { useCallback } from "react"
import { nextOrder, useCreateTask, useProjects, useTasks } from "@/api/kanban"
import { useUI } from "@/components/ui-provider"
import type { TaskStatus } from "@/types"

/**
 * Immediate quick-create: creates the task record right away (empty title)
 * and opens the inline editor with the title input focused.
 * Defaults to the given project, or the Inbox / first project otherwise.
 */
export function useQuickCreate() {
  const { data: tasks = [] } = useTasks()
  const { data: projects = [] } = useProjects()
  const createTask = useCreateTask()
  const { openQuickCreate } = useUI()

  return useCallback(
    async (projectId: string | null, status: TaskStatus) => {
      const pid = projectId ?? projects.find((p) => p.id === "inbox0000000000")?.id ?? projects[0]?.id
      if (!pid) return
      const created = await createTask.mutateAsync({
        project: pid,
        title: "",
        description: "",
        status,
        dueDate: "",
        labels: [],
        order: nextOrder(tasks, pid, status),
      })
      openQuickCreate(created.id, pid, status)
    },
    [tasks, projects, createTask, openQuickCreate]
  )
}
