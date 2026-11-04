import { Moon, Sun } from "lucide-react"
import { useUI } from "@/components/ui-provider"
import { Button } from "@/components/ui/button"

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useUI()
  const dark = theme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      data-testid="theme-toggle"
      className={className}
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </Button>
  )
}
