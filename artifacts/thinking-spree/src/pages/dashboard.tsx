import {
  useGetStatsOverview, useListSprints, useGetMe,
  customFetch,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Calendar, Clock, Users, Zap, Mail, CheckCircle, TrendingUp, Video,
  ChevronRight, ArrowUpRight, RefreshCw, MapPin,
} from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

type CalEvent = {
  id: string; title: string; startTime: string; endTime: string;
  location: string | null; description: string;
  meetLink: string | null; attendees: string[];
  isAllDay: boolean; source: "google" | "sprints";
};

/** Groups calendar events by their start-day. Used by the Dashboard
 *  "Upcoming this week" widget so each day has its own header (Today / Tomorrow
 *  / explicit date). Empty days are omitted. Skips events with malformed dates. */
function groupByDay(events: CalEvent[]): Array<{ dateKey: string; label: string; events: CalEvent[] }> {
  const groups = new Map<string, CalEvent[]>();
  for (const e of events) {
    if (!e.startTime) continue;
    try {
      const d = parseISO(e.startTime);
      const key = format(d, "yyyy-MM-dd");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    } catch { /* skip malformed */ }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, evs]) => {
      const d = parseISO(dateKey + "T00:00:00");
      const label = isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEEE, MMM d");
      return { dateKey, label, events: evs };
    });
}

function StatCard({ label, value, icon: Icon, color, hint }: {
  label: string; value: number | string; icon: React.ElementType; color: string; hint?: string;
}) {  return (
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
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetStatsOverview();
  // Pull a 7-day window of Google Calendar events so the dashboard reflects
  // the consultant's upcoming week, not just today. We use a raw query because
  // the generated client doesn't expose the `days` param.
  const calendarQuery = useQuery<CalEvent[]>({
    queryKey: ["/api/calendar/events", { days: 7 }],
    queryFn: () => customFetch<CalEvent[]>(`${BASE}/api/calendar/events?days=7`, { credentials: "include" }),
    staleTime: 60_000,
  });
  const events = calendarQuery.data;
  const eventsLoading = calendarQuery.isLoading;
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
          {/* This Week's Calendar — grouped by day */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                <h2 className="font-semibold text-foreground">Upcoming this week</h2>
                {events && events.length > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {events.length} session{events.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/calendar/events", { days: 7 }] })}
                  title="Refresh from Google Calendar"
                  className="p-1 text-muted-foreground hover:text-primary transition">
                  <RefreshCw size={12} className={calendarQuery.isFetching ? "animate-spin" : ""} />
                </button>
                <Link href="/sprint-tracking" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5">
                  View all <ArrowUpRight size={11} />
                </Link>
              </div>
            </div>
            {eventsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : events && events.length > 0 ? (
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {groupByDay(events).map(group => (
                  <div key={group.dateKey}>
                    <div className="flex items-baseline gap-2 mb-2">
                      <h3 className="text-xs font-semibold text-foreground">
                        {group.label}
                      </h3>
                      <span className="text-[10px] text-muted-foreground">
                        {group.events.length} session{group.events.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.events.map(event => (
                        <div key={event.id} data-testid={`card-event-${event.id}`}
                          className="flex gap-3 p-3 bg-background rounded-lg border border-border hover:border-primary/30 transition-colors">
                          <div className={`flex-shrink-0 w-1 rounded-full ${
                            event.source === "google" ? "bg-primary" : "bg-violet-500"
                          }`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock size={11} />
                                {event.isAllDay ? "All day" : (
                                  <>{format(parseISO(event.startTime), "h:mm a")} – {format(parseISO(event.endTime), "h:mm a")}</>
                                )}
                              </span>
                              {event.location && !event.location.startsWith("http") && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[160px]" title={event.location}>
                                  <MapPin size={11} />{event.location}
                                </span>
                              )}
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar size={32} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No sessions scheduled this week</p>
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
