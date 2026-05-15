import { useState, useMemo } from "react";
import { useListSprints, useListIncubators, useUpdateSprint, getListSprintsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, CheckCircle, Clock, XCircle, Zap, ChevronRight, Search,
  User, Calendar as CalendarIcon, TrendingUp, Filter, X, ArrowUpDown,
  LayoutGrid, Table as TableIcon, ChevronUp, ChevronDown, RotateCcw, Loader2,
} from "lucide-react";
import { format, parseISO, isThisWeek, isThisMonth } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────
type Sprint = {
  id: number; founderId: number; founderName: string; companyName: string;
  industry?: string | null; stage?: string | null;
  programName?: string | null; partnerName?: string | null;
  scheduledDate: string; scheduledTime?: string | null; endTime?: string | null;
  totalDuration?: string | null;
  consultantName: string; sprintHost?: string | null; coHost?: string | null;
  status: string;
  sprintNumber?: number | null;
  sessionType?: string | null;
  paymentStatus?: string | null;
  billedTo?: string | null;
  cyYear?: number | null; month?: number | null; week?: number | null; quarter?: string | null;
  strengths?: string | null; gaps?: string | null; nextGoal?: string | null;
};

type SortKey = "date" | "company" | "host" | "status" | "sprintNumber";
type SortDir = "asc" | "desc";

const STATUS_CONFIG = {
  completed: { icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", label: "Completed" },
  scheduled: { icon: Clock,       color: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-100 dark:bg-blue-900/30",       label: "Scheduled" },
  cancelled: { icon: XCircle,     color: "text-red-600 dark:text-red-400",          bg: "bg-red-100 dark:bg-red-900/30",          label: "Cancelled" },
};

// ─── Components ───────────────────────────────────────────────────────────
function StatsStrip({ sprints }: { sprints: Sprint[] }) {
  const completed = sprints.filter(s => s.status === "completed").length;
  const scheduled = sprints.filter(s => s.status === "scheduled").length;
  const thisWeek = sprints.filter(s => {
    try { return isThisWeek(parseISO(s.scheduledDate + "T00:00:00")); } catch { return false; }
  }).length;
  const thisMonth = sprints.filter(s => {
    try { return isThisMonth(parseISO(s.scheduledDate + "T00:00:00")); } catch { return false; }
  }).length;

  const items = [
    { label: "Showing",     value: sprints.length, color: "text-foreground", icon: Zap },
    { label: "Completed",   value: completed,      color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle },
    { label: "Scheduled",   value: scheduled,      color: "text-blue-600 dark:text-blue-400", icon: Clock },
    { label: "This Week",   value: thisWeek,       color: "text-violet-600 dark:text-violet-400", icon: CalendarIcon },
    { label: "This Month",  value: thisMonth,      color: "text-amber-600 dark:text-amber-400", icon: TrendingUp },
    { label: "Analysis",    value: sprints.filter(s => s.strengths || s.gaps || s.nextGoal).length, color: "text-primary", icon: Activity },
  ];
  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {items.map(({ label, value, color, icon: Icon }) => (
        <div key={label} className="bg-card border border-card-border rounded-xl p-3.5 text-center">
          <Icon size={14} className={`mx-auto mb-1 ${color}`} />
          <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</p>
        </div>
      ))}
    </div>
  );
}

function SprintCard({ sprint, onClick }: { sprint: Sprint; onClick: () => void }) {
  const sc = STATUS_CONFIG[sprint.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.scheduled;
  const hasAnalysis = !!(sprint.strengths || sprint.gaps || sprint.nextGoal);
  return (
    <div onClick={onClick}
      className="bg-card border border-card-border rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-foreground text-sm truncate">{sprint.companyName}</h3>
            {sprint.sprintNumber != null && (
              <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                #{sprint.sprintNumber}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{sprint.founderName}</p>
        </div>
        <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${sc.bg} ${sc.color}`}>
          <sc.icon size={10} />{sc.label}
        </span>
      </div>

      <div className="space-y-1 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarIcon size={10} />
          {format(parseISO(sprint.scheduledDate + "T00:00:00"), "d MMM yyyy")}
          {sprint.scheduledTime && <span>· {sprint.scheduledTime}</span>}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User size={10} />
          {sprint.sprintHost ?? sprint.consultantName}
          {sprint.coHost && <span className="text-muted-foreground/60">+ {sprint.coHost}</span>}
        </div>
        {sprint.programName && (
          <div className="text-[11px] text-muted-foreground/80 truncate">
            <span className="font-medium">Program:</span> {sprint.programName}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {sprint.sessionType && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{sprint.sessionType}</span>
          )}
          {hasAnalysis && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
              <Activity size={10} />Analysis
            </span>
          )}
        </div>
        <ChevronRight size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function SprintTrackingPage() {
  const [, setLocation] = useLocation();
  const { data: sprintsData, isLoading } = useListSprints();
  const { data: incubators } = useListIncubators();
  const sprints: Sprint[] = (sprintsData ?? []) as Sprint[];

  // ─── Filter state — mirrors Sheet Tracking columns ─────────────────────
  const [searchText, setSearchText]   = useState("");
  const [status, setStatus]           = useState<"all"|"scheduled"|"completed"|"cancelled">("all");
  const [industry, setIndustry]       = useState("all");
  const [stage, setStage]             = useState("all");
  const [program, setProgram]         = useState("all");
  const [partner, setPartner]         = useState("all");
  const [host, setHost]               = useState("all");
  const [coHost, setCoHost]           = useState("all");
  const [sessionType, setSessionType] = useState("all");
  const [payment, setPayment]         = useState("all");
  const [year, setYear]               = useState("all");
  const [quarter, setQuarter]         = useState("all");
  const [month, setMonth]             = useState("all");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");

  // Sort — default: most recent date first
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [view, setView] = useState<"cards" | "table">("table");

  // Build distinct option lists from data
  const opts = useMemo(() => {
    const dedup = <T,>(arr: (T | null | undefined)[]) => [...new Set(arr.filter(Boolean) as T[])].sort();
    return {
      industries:   dedup(sprints.map(s => s.industry)),
      stages:       dedup(sprints.map(s => s.stage)),
      programs:     dedup(sprints.map(s => s.programName)),
      partners:     dedup(sprints.map(s => s.partnerName)),
      hosts:        dedup(sprints.map(s => s.sprintHost ?? s.consultantName)),
      coHosts:      dedup(sprints.map(s => s.coHost)),
      sessionTypes: dedup(sprints.map(s => s.sessionType)),
      payments:     dedup(sprints.map(s => s.paymentStatus)),
      years:        dedup(sprints.map(s => s.cyYear?.toString())),
      quarters:     ["Q1","Q2","Q3","Q4"],
      months:       Array.from({ length: 12 }, (_, i) => String(i + 1)),
    };
  }, [sprints]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return sprints.filter(s => {
      if (q && !`${s.companyName} ${s.founderName} ${s.consultantName ?? ""}`.toLowerCase().includes(q)) return false;
      if (status !== "all" && s.status !== status) return false;
      if (industry !== "all" && s.industry !== industry) return false;
      if (stage !== "all" && s.stage !== stage) return false;
      if (program !== "all" && s.programName !== program) return false;
      if (partner !== "all" && s.partnerName !== partner) return false;
      if (host !== "all" && (s.sprintHost ?? s.consultantName) !== host) return false;
      if (coHost !== "all" && s.coHost !== coHost) return false;
      if (sessionType !== "all" && s.sessionType !== sessionType) return false;
      if (payment !== "all" && s.paymentStatus !== payment) return false;
      if (year !== "all" && String(s.cyYear) !== year) return false;
      if (quarter !== "all" && s.quarter !== quarter) return false;
      if (month !== "all" && String(s.month) !== month) return false;
      if (dateFrom && s.scheduledDate < dateFrom) return false;
      if (dateTo && s.scheduledDate > dateTo) return false;
      return true;
    });
  }, [sprints, searchText, status, industry, stage, program, partner, host, coHost, sessionType, payment, year, quarter, month, dateFrom, dateTo]);

  // Sort
  const sorted = useMemo(() => {
    const out = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.scheduledDate.localeCompare(b.scheduledDate);
      else if (sortKey === "company") cmp = a.companyName.localeCompare(b.companyName);
      else if (sortKey === "host") cmp = (a.sprintHost ?? a.consultantName).localeCompare(b.sprintHost ?? b.consultantName);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "sprintNumber") cmp = (a.sprintNumber ?? 0) - (b.sprintNumber ?? 0);
      return cmp * dir;
    });
    return out;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "date" ? "desc" : "asc"); }
  }

  function resetFilters() {
    setSearchText(""); setStatus("all"); setIndustry("all"); setStage("all");
    setProgram("all"); setPartner("all"); setHost("all"); setCoHost("all");
    setSessionType("all"); setPayment("all"); setYear("all"); setQuarter("all");
    setMonth("all"); setDateFrom(""); setDateTo("");
  }
  const activeFilterCount = [
    status, industry, stage, program, partner, host, coHost, sessionType, payment, year, quarter, month,
  ].filter(v => v !== "all").length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (searchText.trim() ? 1 : 0);

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sprint Tracking</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All sessions aligned to you · matches the Sheet Tracking format
            </p>
          </div>
          <div className="flex items-center gap-1 bg-card border border-card-border rounded-lg p-0.5">
            <button onClick={() => setView("table")} title="Table view"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition ${
                view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              <TableIcon size={13} />Table
            </button>
            <button onClick={() => setView("cards")} title="Card view"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition ${
                view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              <LayoutGrid size={13} />Cards
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : (
          <>
            <StatsStrip sprints={sorted} />

            {/* ─── Filter bar (matches Sheet Tracking) ─── */}
            <div className="bg-card border border-card-border rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Filters</h3>
                  {activeFilterCount > 0 && (
                    <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </div>
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <RotateCcw size={11} />Reset
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  placeholder="Search company, founder, or host…"
                  className="w-full pl-9 pr-9 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/60"
                />
                {searchText && (
                  <button onClick={() => setSearchText("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Quick status chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(["all","scheduled","completed","cancelled"] as const).map(f => (
                  <button key={f} onClick={() => setStatus(f)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition capitalize ${
                      status === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}>
                    {f === "all" ? "All statuses" : f}
                  </button>
                ))}
              </div>

              {/* Dropdown filters — match sheet headers */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                <FilterDropdown label="Industry"      value={industry}     setValue={setIndustry}     options={opts.industries} />
                <FilterDropdown label="Stage"         value={stage}        setValue={setStage}        options={opts.stages} />
                <FilterDropdown label="Program"       value={program}      setValue={setProgram}      options={opts.programs} />
                <FilterDropdown label="Partner"       value={partner}      setValue={setPartner}      options={opts.partners} />
                <FilterDropdown label="Sprint Host"   value={host}         setValue={setHost}         options={opts.hosts} />
                <FilterDropdown label="Co-Host"       value={coHost}       setValue={setCoHost}       options={opts.coHosts} />
                <FilterDropdown label="Session Type"  value={sessionType}  setValue={setSessionType}  options={opts.sessionTypes} />
                <FilterDropdown label="Payment"       value={payment}      setValue={setPayment}      options={opts.payments} />
                <FilterDropdown label="CY Year"       value={year}         setValue={setYear}         options={opts.years} />
                <FilterDropdown label="Quarter"       value={quarter}      setValue={setQuarter}      options={opts.quarters} />
                <FilterDropdown label="Month"         value={month}        setValue={setMonth}        options={opts.months} renderOption={(m) => format(new Date(2000, Number(m)-1, 1), "MMM")} />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            </div>

            {/* ─── Results ─── */}
            {sorted.length === 0 ? (
              <div className="text-center py-16 bg-card border border-card-border rounded-xl">
                <Activity size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-medium">No sprints match your filters</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try clearing some filters above</p>
              </div>
            ) : view === "table" ? (
              <SprintTable sorted={sorted} sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort}
                onRowClick={(id) => setLocation(`/sprints/${id}`)} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sorted.map(sprint => (
                  <SprintCard key={sprint.id} sprint={sprint} onClick={() => setLocation(`/sprints/${sprint.id}`)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────
function FilterDropdown<T extends string>({
  label, value, setValue, options, renderOption,
}: {
  label: string; value: string; setValue: (v: string) => void; options: T[];
  renderOption?: (v: T) => string;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</label>
      <select value={value} onChange={e => setValue(e.target.value)}
        className="w-full px-2.5 py-1.5 bg-background border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
        <option value="all">All</option>
        {options.map(o => <option key={o} value={o}>{renderOption ? renderOption(o) : o}</option>)}
      </select>
    </div>
  );
}

function SortHeader({ label, k, sortKey, sortDir, toggleSort }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir; toggleSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-1 text-left hover:text-foreground transition">
      {label}
      {active ? (sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={9} className="opacity-30" />}
    </button>
  );
}

function SprintTable({
  sorted, sortKey, sortDir, toggleSort, onRowClick,
}: {
  sorted: Sprint[]; sortKey: SortKey; sortDir: SortDir;
  toggleSort: (k: SortKey) => void; onRowClick: (id: number) => void;
}) {
  const updateSprint = useUpdateSprint();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function handleStatusChange(id: number, newStatus: string) {
    setUpdatingId(id);
    try {
      await updateSprint.mutateAsync({ id, data: { status: newStatus } as any });
      await queryClient.invalidateQueries({ queryKey: getListSprintsQueryKey() });
      toast({ title: "Status updated", description: `Sprint marked ${newStatus}` });
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium"><SortHeader label="Date" k="date" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} /></th>
              <th className="px-3 py-2.5 text-left font-medium"><SortHeader label="Company" k="company" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} /></th>
              <th className="px-3 py-2.5 text-left font-medium">Founder</th>
              <th className="px-3 py-2.5 text-left font-medium">Industry</th>
              <th className="px-3 py-2.5 text-left font-medium">Stage</th>
              <th className="px-3 py-2.5 text-left font-medium">Program</th>
              <th className="px-3 py-2.5 text-left font-medium"><SortHeader label="Host" k="host" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} /></th>
              <th className="px-3 py-2.5 text-left font-medium">Co-Host</th>
              <th className="px-3 py-2.5 text-center font-medium"><SortHeader label="#" k="sprintNumber" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} /></th>
              <th className="px-3 py-2.5 text-left font-medium">Type</th>
              <th className="px-3 py-2.5 text-left font-medium"><SortHeader label="Status" k="status" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} /></th>
              <th className="px-3 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map(s => {
              const sc = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.scheduled;
              return (
                <tr key={s.id}
                  className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5 whitespace-nowrap text-foreground tabular-nums cursor-pointer" onClick={() => onRowClick(s.id)}>
                    {format(parseISO(s.scheduledDate + "T00:00:00"), "d MMM yy")}
                    {s.scheduledTime && <div className="text-[10px] text-muted-foreground">{s.scheduledTime}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-foreground font-medium max-w-[160px] truncate cursor-pointer" title={s.companyName} onClick={() => onRowClick(s.id)}>{s.companyName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate cursor-pointer" title={s.founderName} onClick={() => onRowClick(s.id)}>{s.founderName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[110px] truncate">{s.industry ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[110px] truncate">{s.stage ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate" title={s.programName ?? undefined}>{s.programName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-foreground">{s.sprintHost ?? s.consultantName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.coHost ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{s.sprintNumber ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.sessionType ?? "—"}</td>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    {updatingId === s.id ? (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Loader2 size={9} className="animate-spin" />Saving…
                      </span>
                    ) : (
                      <div className="relative">
                        <select
                          value={s.status}
                          onChange={e => handleStatusChange(s.id, e.target.value)}
                          className={`appearance-none cursor-pointer pl-2 pr-5 py-0.5 text-[10px] font-medium rounded-full ${sc.bg} ${sc.color} border border-transparent focus:outline-none focus:ring-1 focus:ring-ring`}
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <ChevronDown size={8} className={`absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none ${sc.color}`} />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground cursor-pointer" onClick={() => onRowClick(s.id)}><ChevronRight size={14} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
