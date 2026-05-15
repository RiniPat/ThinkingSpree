import { Link, useLocation } from "wouter";
import { useLogout, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Briefcase,
  Zap,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Activity,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logoPath from "@assets/thinkingspree_logo_1778683092464.jpg";

type NavItem = { href: string; label: string; icon: any; adminOnly?: boolean };

const navItems: NavItem[] = [
  { href: "/dashboard",       label: "Dashboard",       icon: LayoutDashboard },
  { href: "/ventures",        label: "Ventures",        icon: Briefcase },
  { href: "/sprints",         label: "T-Sprints",       icon: Zap },
  { href: "/summary",         label: "Summary Sheet",   icon: BarChart3 },
  { href: "/sprint-tracking", label: "Sprint Tracking", icon: Activity },
  { href: "/admin/import",    label: "Import Data",     icon: Upload, adminOnly: true },
  { href: "/settings",        label: "Settings",        icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();
  const { data: user } = useGetMe();

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/login";
      },
    });
  }

  const Sidebar = ({ mobile = false }) => (
    <div className={cn(
      "flex flex-col h-full bg-sidebar text-sidebar-foreground",
      mobile ? "w-full" : "w-64 fixed top-0 left-0 bottom-0 z-30"
    )}>
      <div className="flex items-center px-6 py-5 border-b border-sidebar-border">
        <img src={logoPath} alt="Thinking Spree" className="h-7 w-auto invert" />
      </div>

      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
            {user?.name?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">{user?.name ?? "Consultant"}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.role ?? "Consultant"}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems
          .filter(item => !item.adminOnly || (user as any)?.isAdmin)
          .map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== "/dashboard" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <a
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon size={16} />
                {label}
              </a>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-all duration-150"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border sticky top-0 z-40">
        <img src={logoPath} alt="Thinking Spree" className="h-6 w-auto invert" />
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-sidebar-foreground">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/60" onClick={() => setMobileOpen(false)}>
          <div className="w-72 h-full" onClick={e => e.stopPropagation()}>
            <Sidebar mobile />
          </div>
        </div>
      )}

      <main className="md:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
