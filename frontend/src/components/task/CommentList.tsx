import { useEffect, useState, type FormEvent } from "react"
import { MessageSquare, Trash2 } from "lucide-react"
import { useCreateComment, useDeleteComment, useComments } from "@/api/kanban"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Task } from "@/types"

export default function CommentList({ task }: { task: Task }) {
  const { data: comments = [] } = useComments(task.id)
  const createComment = useCreateComment()
  const deleteComment = useDeleteComment()
  const [text, setText] = useState("")

  useEffect(() => {
    setText("")
  }, [task.id])

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    createComment.mutate({ task: task.id, text: t })
    setText("")
  }

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" /> Comments
      </p>
      <div className="space-y-2">
        {comments.map((c) => (
          <div
            key={c.id}
            data-testid="comment"
            className="group flex items-start justify-between gap-2 rounded-md border px-2.5 py-2 text-sm"
          >
            <span className="whitespace-pre-wrap break-words">{c.text}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => deleteComment.mutate({ task: task.id, id: c.id })}
              title="Delete comment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
      </div>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={!text.trim()}>
          Add
        </Button>
      </form>
    </div>
  )
}
