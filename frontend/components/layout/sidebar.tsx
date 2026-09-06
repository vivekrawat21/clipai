"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Clapperboard,
  LayoutDashboard,
  Scissors,
  Send,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/videos", label: "Videos", icon: Clapperboard },
  { href: "/clips", label: "Clips", icon: Scissors },
  { href: "/publishing", label: "Publishing", icon: Send },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      <aside
        aria-label="Primary"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card/95 backdrop-blur transition-[width,transform] duration-300 lg:static lg:translate-x-0",
          collapsed ? "lg:w-[68px]" : "lg:w-60",
          mobileOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:w-auto",
        )}
      >
        {/* Brand row */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-border px-4",
            collapsed && "lg:justify-center lg:px-0",
          )}
        >
          <Link href="/dashboard" aria-label="ClipAI home" className="min-w-0">
            <Logo showWordmark={!collapsed} />
          </Link>
          <button
            onClick={onCloseMobile}
            className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      collapsed && "lg:justify-center lg:px-0",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-5 shrink-0" strokeWidth={active ? 2.2 : 2} />
                    <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom: accounts + profile */}
        <div className="shrink-0 border-t border-border p-3">
          <div
            className={cn(
              "flex flex-col gap-1",
              collapsed && "lg:items-center lg:gap-3",
            )}
          >
            <NavFooterLink collapsed={collapsed} href="/publishing" label="Connected accounts" />
            <NavFooterLink collapsed={collapsed} href="/settings" label="Your profile" />
          </div>
        </div>
      </aside>
    </>
  );
}

function NavFooterLink({
  href,
  label,
  collapsed,
}: {
  href: string;
  label: string;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        collapsed && "lg:justify-center",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Sparkles className="size-4" />
      </span>
      <span className={cn("min-w-0 truncate font-medium", collapsed && "lg:hidden")}>
        {label}
      </span>
    </Link>
  );
}