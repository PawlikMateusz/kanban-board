import { Download, Paperclip, Upload, X } from "lucide-react"
import { useAddAttachments, useRemoveAttachment } from "@/api/kanban"
import { Button } from "@/components/ui/button"
import { fileUrl } from "@/lib/pb"
import type { Task } from "@/types"

export default function AttachmentList({ task }: { task: Task }) {
  const addAttachments = useAddAttachments()
  const removeAttachment = useRemoveAttachment()

  return (
    <div>
      <div className="space-y-1.5">
        {task.attachments.map((name) => (
          <div
            key={name}
            className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
          >
            <a
              href={fileUrl(task, name)}
              download
              className="flex min-w-0 items-center gap-2 text-foreground/80 hover:text-foreground hover:underline"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{name}</span>
              <Download className="h-3 w-3 shrink-0 text-muted-foreground" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Remove attachment"
              onClick={() => removeAttachment.mutate({ taskId: task.id, filename: name })}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {task.attachments.length === 0 && (
          <p className="text-xs text-muted-foreground">No attachments.</p>
        )}
      </div>
      <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
        <Upload className="h-4 w-4" /> Upload files
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) addAttachments.mutate({ taskId: task.id, files })
            e.target.value = ""
          }}
        />
      </label>
    </div>
  )
}
