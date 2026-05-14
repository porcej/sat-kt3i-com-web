import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex gap-1">
        <Button size="icon" variant="outline" disabled aria-label="Theme">
          <Sun className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex gap-1 rounded-md border p-1">
      <Button
        size="sm"
        variant={theme === "light" ? "secondary" : "ghost"}
        className="h-8 px-2"
        onClick={() => setTheme("light")}
        aria-label="Light theme"
      >
        <Sun className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant={theme === "system" ? "secondary" : "ghost"}
        className="h-8 px-2"
        onClick={() => setTheme("system")}
        aria-label="System theme"
      >
        <Monitor className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant={theme === "dark" ? "secondary" : "ghost"}
        className="h-8 px-2"
        onClick={() => setTheme("dark")}
        aria-label="Dark theme"
      >
        <Moon className="h-4 w-4" />
      </Button>
    </div>
  );
}
