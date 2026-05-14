import { NavLink } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type AppShellProps = {
  pageTitle: string;
  pageDescription?: string;
  children: React.ReactNode;
};

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-2 py-1 transition-colors hover:bg-muted",
    isActive ? "bg-muted text-foreground" : "text-muted-foreground"
  );

export function AppShell({ pageTitle, pageDescription, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{pageTitle}</h1>
            {pageDescription ? (
              <p className="text-sm text-muted-foreground">{pageDescription}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3 sm:pt-0.5">
            <nav className="flex gap-1 text-sm font-medium" aria-label="Main">
              <NavLink to="/" end className={navClass}>
                Dashboard
              </NavLink>
              <NavLink to="/batch" className={navClass}>
                Batch predictions
              </NavLink>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
