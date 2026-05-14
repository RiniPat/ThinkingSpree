import {
  useGetCalendarEvents, useGetStatsOverview, useListSprints, useGetMe,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Calendar, Clock, Users, Zap, Mail, CheckCircle, TrendingUp, Video,
  ChevronRight, ArrowUpRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";

function StatCard({ label, value, icon: Icon, color, hint }: {
  label: string; value: number | string; icon: React.ElementType; color: string; hint?: string;
}) {
  return (
    <div data-testid={`card-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className="bg-card border border-card-border rounded-xl p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-1.5 tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color} shrink-0`}>
          <Icon size={18} className="text-primary-foreground" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetStatsOverview();
  const { data: events, isLoading: eventsLoading } = useGetCalendarEvents();
  const { data: sprints, isLoading: sprintsLoading } = useListSprints();
  const { data: user } = useGetMe();

  // Sprints come back already scoped to this user from the backend.
  // We show the 5 most recent (already DESC sorted server-side).
  const recentSprints = sprints?.slice(0, 5) ?? [];
  const today = format(new Date(), "EEEE, MMMM d, yyyy");
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm text-muted-foreground font-medium">{today}</p>
          <h1 className="text-2xl font-bold text-foreground mt-0.5">{greeting}, {firstName}.</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's what's on your plate today — only sprints aligned to you are shown below.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {statsLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <StatCard label="My T-Sprints"     value={stats?.totalSprints ?? 0}        icon={Zap}          color="bg-primary"     hint="Total assigned to me" />
              <StatCard label="Scheduled"        value={stats?.scheduledSprints ?? 0}    icon={Calendar}     color="bg-blue-500" />
              <StatCard label="Completed"        value={stats?.completedSprints ?? 0}    icon={CheckCircle}  color="bg-green-600" />
              <StatCard label="My Founders"      value={stats?.totalFounders ?? 0}       icon={Users}        color="bg-violet-500" hint="Unique founders worked with" />
              <StatCard label="Emails This Month"value={stats?.emailsSentThisMonth ?? 0} icon={Mail}         color="bg-amber-500" />
              <StatCard label="This Week"        value={stats?.upcomingThisWeek ?? 0}    icon={TrendingUp}   color="bg-rose-500" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Calendar */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                <h2 className="font-semibold text-foreground">Today's Schedule</h2>
              </div>
              <Link href="/sprint-tracking" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5">
                View all <ArrowUpRight size={11} />
              </Link>
            </div>
            {eventsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : events && events.length > 0 ? (
              <div className="space-y-3">
                {events.map(event => (
                  <div key={event.id} data-testid={`card-event-${event.id}`}
                    className="flex gap-3 p-3 bg-background rounded-lg border border-border hover:border-primary/30 transition-colors">
                    <div className="flex-shrink-0 w-1 bg-primary rounded-full" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock size={11} />
                          {format(parseISO(event.startTime), "h:mm a")} – {format(parseISO(event.endTime), "h:mm a")}
                        </span>
                        {event.meetLink && (
                          <a href={event.meetLink} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <Video size={11} />Join
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar size={32} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No sessions scheduled today</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Connect Google Calendar in Settings to sync</p>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-primary" />
                <h2 className="font-semibold text-foreground">My Recent T-Sprints</h2>
              </div>
              <Link href="/sprints" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5">
                View all <ArrowUpRight size={11} />
              </Link>
            </div>
            {sprintsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : recentSprints.length > 0 ? (
              <div className="space-y-2">
                {recentSprints.map(sprint => (
                  <Link key={sprint.id} href={`/sprints/${sprint.id}`}>
                    <a data-testid={`card-sprint-${sprint.id}`}
                      className="flex items-center justify-between p-3 bg-background rounded-lg border border-border hover:border-primary/30 transition-colors group">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{sprint.companyName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {sprint.founderName} · {sprint.scheduledDate}
                          {sprint.sprintHost && sprint.sprintHost !== sprint.consultantName ? ` · Host: ${sprint.sprintHost}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                          sprint.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          sprint.status === "cancelled" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}>
                          {sprint.status}
                        </span>
                        <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </a>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap size={32} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No T-Sprints assigned to you yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
