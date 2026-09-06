"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Plus, Sun } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { useLocalStorage } from "@/lib/use-local-storage";

const TITLES: Array<[RegExp, string]> = [
  [/^\/dashboard/, "Dashboard"],
  [/^\/videos\/new/, "Create Clips"],
  [/^\/videos(\/\d+)?$/, "Videos"],
  [/^\/clips\/\d+/, "Clip Editor"],
  [/^\/clips/, "Clips"],
  [/^\/publishing/, "Publishing"],
  [/^\/analytics/, "Analytics"],
  [/^\/settings/, "Settings"],
];

function titleFor(pathname: string): string {
  for (const [regex, title] of TITLES) {
    if (regex.test(pathname)) return title;
  }
  return "ClipAI";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useLocalStorage("clipai-sidebar-collapsed", false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { toggleTheme, theme } = useTheme();
  const pathname = usePathname();

  // Close the mobile drawer on navigation without an effect (render-phase
  // state adjustment — the React-recommended replacement for this pattern).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  const toggleCollapsed = () => setCollapsed(!collapsed);

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Slim top bar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              className="hidden lg:inline-flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              {titleFor(pathname)}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            <Link
              href="/videos/new"
              className={buttonVariants({ size: "sm", className: "hidden sm:inline-flex" })}
            >
              <Plus className="size-4" />
              Create Clips
            </Link>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}