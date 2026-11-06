"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight, LifeBuoy, LogOut, Zap, ChevronsUpDown, Check, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import type { ConnectedAccount } from "@/hooks/use-instagram-session"

const NAV = [
  { href: "/dashboard", label: "Home", icon: "/icons/home.svg" },
  { href: "/dashboard/automations", label: "Auto replies", icon: "/icons/journal.svg" },
  { href: "/dashboard/inbox", label: "Conversations", icon: "/icons/chat.svg" },
  { href: "/dashboard/ice-breakers", label: "Conversation starters", icon: "/icons/squads.svg" },
  { href: "/dashboard/analytics", label: "Insights", icon: "/icons/analytics.svg" },
]

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  username?: string
  profilePic?: string | null
  accounts?: ConnectedAccount[]
  onSwitchAccount?: (account: ConnectedAccount) => void
  onLogout?: () => void
  onNavigate?: () => void
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({
  className,
  username = "creator",
  profilePic,
  accounts = [],
  onSwitchAccount,
  onLogout,
  onNavigate,
  collapsed = false,
  onToggle,
  ...props
}: SidebarProps) {
  const pathname = usePathname()
  const [showAccountMenu, setShowAccountMenu] = useState(false)

  const itemClass = (active: boolean) => cn(
    "relative flex h-10 items-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    collapsed ? "justify-center px-0" : "gap-3 px-3",
    active ? "bg-sidebar-accent text-sidebar-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
  )

  return (
    <aside className={cn("flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground", className)} {...props}>
      <div className={cn("flex h-16 items-center border-b border-sidebar-border", collapsed ? "justify-center" : "px-3")}>
        <Link href="/dashboard" onClick={onNavigate} aria-label="insta-p8 home" className={cn("flex items-center gap-2.5 rounded-lg", !collapsed && "px-2")}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Zap className="size-4" /></span>
          {!collapsed && <span className="text-sm font-semibold tracking-tight">insta-p8</span>}
        </Link>
        {!collapsed && onToggle && <button onClick={onToggle} aria-label="Collapse sidebar" title="Collapse sidebar" className="ml-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"><ChevronLeft className="size-4" /></button>}
      </div>

      {collapsed && onToggle && <div className="px-3 pt-3"><button onClick={onToggle} aria-label="Expand sidebar" title="Expand sidebar" className="flex size-10 w-full items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"><ChevronRight className="size-4" /></button></div>}

      <nav className="flex-1 space-y-1 px-3 py-3" aria-label="Dashboard navigation">
        {NAV.map(item => {
          const active = pathname === item.href
          return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} aria-label={collapsed ? item.label : undefined} title={collapsed ? item.label : undefined} className={itemClass(active)}>
            <img src={item.icon} alt="" className={cn("size-4 shrink-0 dark:invert", active && item.href === "/dashboard" && "dark:invert-0")} />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        })}

        <div className="my-3 h-px bg-sidebar-border" />

        <Link href="/dashboard/settings" onClick={onNavigate} aria-current={pathname === "/dashboard/settings" ? "page" : undefined} aria-label={collapsed ? "Preferences" : undefined} title={collapsed ? "Preferences" : undefined} className={itemClass(pathname === "/dashboard/settings")}>
          <img src="/icons/profile.svg" alt="" className="size-4 shrink-0 dark:invert" />
          {!collapsed && <span>Preferences</span>}
        </Link>
        <a href="https://t.me/instagramautomationp8" target="_blank" rel="noopener noreferrer" aria-label={collapsed ? "Help and support" : undefined} title={collapsed ? "Help and support" : undefined} className={itemClass(false)}>
          <LifeBuoy className="size-4 shrink-0" />
          {!collapsed && <span>Help and support</span>}
        </a>
      </nav>

      <div className="relative border-t border-sidebar-border p-3">
        {!collapsed && <div className="mb-3 flex items-center justify-between px-1"><span className="text-xs text-muted-foreground">Appearance</span><ThemeToggle className="h-7 w-14" /></div>}

        {/* Account Switcher Popup */}
        {showAccountMenu && accounts.length > 0 && !collapsed && (
          <div className="absolute bottom-16 left-3 right-3 z-50 rounded-xl border border-sidebar-border bg-card p-2 shadow-xl">
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Switch Account</p>
            <div className="mt-1 space-y-1">
              {accounts.map(acc => {
                const isActive = acc.username.toLowerCase() === username.toLowerCase()
                return (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setShowAccountMenu(false)
                      onSwitchAccount?.(acc)
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                      isActive ? "bg-sidebar-accent font-medium text-sidebar-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <span className="truncate">@{acc.username}</span>
                    {isActive && <Check className="size-3.5 text-foreground" />}
                  </button>
                )
              })}
            </div>
            <div className="my-1.5 h-px bg-border" />
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Plus className="size-3" /> Connect another account
            </Link>
          </div>
        )}

        <div className={cn("flex items-center rounded-lg bg-sidebar-accent p-2", collapsed ? "justify-center" : "gap-2.5")}>
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            {profilePic ? <img src={profilePic} alt={username} className="size-full object-cover" /> : username.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <button
                onClick={() => setShowAccountMenu(prev => !prev)}
                className="min-w-0 flex-1 text-left group"
                title="Switch Instagram account"
              >
                <div className="flex items-center gap-1">
                  <p className="truncate text-xs font-medium">@{username}</p>
                  <ChevronsUpDown className="size-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Switch / Manage</p>
              </button>
              <button onClick={onLogout} aria-label="Log out" title="Log out" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar hover:text-destructive">
                <LogOut className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
