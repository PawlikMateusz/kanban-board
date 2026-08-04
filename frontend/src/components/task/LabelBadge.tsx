import type { Label } from "@/types"

export function LabelBadge({ label }: { label: Label }) {
  const color = label.color || "#64748b"
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
      style={{ backgroundColor: color + "1f", color }}
    >
      {label.name}
    </span>
  )
}
