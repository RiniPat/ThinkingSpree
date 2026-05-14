/**
 * Seed script — imports the ISB + JU summary sheets and the Sheet Tracking
 * sprint log into the database.
 *
 * Place the three Excel files in scripts/seed-data/ before running:
 *   - ISB_Summary_Sheet.xlsx
 *   - JU_Summary_Sheet.xlsx
 *   - Sheet_Tracking.xlsx
 *
 * Usage:
 *   pnpm tsx scripts/src/seed-summary-sheets.ts
 *
 * Idempotent — looks up founders by (companyName, incubatorId) and updates
 * in place if found; same for sprints by (founderId, scheduledDate, sprintNumber).
 */
import { db, incubatorsTable, foundersTable, sprintsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import XLSX from "xlsx";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../seed-data");
const ISB_FILE      = path.join(DATA_DIR, "ISB_Summary_Sheet.xlsx");
const JU_FILE       = path.join(DATA_DIR, "JU_Summary_Sheet.xlsx");
const TRACKING_FILE = path.join(DATA_DIR, "Sheet_Tracking.xlsx");

// ─── Helpers ──────────────────────────────────────────────────────────────
type Row = (string | number | null)[];

function readSheet(file: string, sheetName?: string): Row[] {
  if (!fs.existsSync(file)) {
    console.warn(`⚠️  Skipping missing file: ${file}`);
    return [];
  }
  const wb = XLSX.readFile(file, { cellDates: true });
  const sName = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[sName];
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, blankrows: false, defval: null }) as Row[];
}

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}
function n(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function asBool(v: unknown): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  const t = String(v).toLowerCase();
  if (["yes","y","true","1"].includes(t)) return true;
  if (["no","n","false","0"].includes(t)) return false;
  return null;
}
function parseRevenue(v: unknown): string | null {
  // The sheets mix numbers and "NA" — keep as a free-text string for fidelity.
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

async function getOrCreateIncubator(name: string, type: "isb"|"ju"|"demo", description?: string) {
  const [existing] = await db.select().from(incubatorsTable).where(eq(incubatorsTable.name, name)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(incubatorsTable).values({ name, type, description }).returning();
  return created;
}

async function upsertFounder(payload: typeof foundersTable.$inferInsert) {
  const [existing] = await db.select().from(foundersTable)
    .where(and(eq(foundersTable.companyName, payload.companyName), eq(foundersTable.incubatorId, payload.incubatorId!)))
    .limit(1);
  if (existing) {
    const [updated] = await db.update(foundersTable).set({
      ...payload,
      id: undefined as any,
      createdAt: undefined as any,
    }).where(eq(foundersTable.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db.insert(foundersTable).values(payload).returning();
  return created;
}

// ─── Summary sheet importer (ISB + JU) ────────────────────────────────────
async function importSummarySheet(file: string, programName: "ISB"|"JU", incId: number) {
  const rows = readSheet(file);
  if (rows.length === 0) return 0;

  // Both ISB and JU share columns 1..10; from col 11 the layouts diverge slightly.
  // We use the actual header row (row 1) for both to look up by name.
  const headers = (rows[0] ?? []).map(h => String(h ?? "").replace(/\s+/g, " ").trim());
  const idx = (label: string) => headers.findIndex(h => h.toLowerCase().includes(label.toLowerCase()));

  const C = {
    startup:    idx("Startup"),
    consultant: idx("Consultant"),
    stage:      idx("Stage of the business"),
    goal:       idx("Goal Setting"),
    rev12:      idx("Last 12 months"),
    revMrr:     idx("Last month MRR"),
    teamSize:   idx("no of team members"),
    strength:   idx("Key Strength"),
    gap:        idx("Gap"),
    concept:    idx("Concept and Sessions"),
    mentor:     idx("Mentor Connect"),
    market:     idx("Market Access"),
    icp:        idx("Ideal Customer"),
    marketTimeline: idx("Timeline for Market"),
    observations:   idx("Observations by TS"),
    recForVc:   idx("Worthy for VC"),
    prevFund:   idx("Previous Fundraise (in INR)"),
    prevFundOrg:idx("Previous Fundraise Organ"),
    burn:       idx("Current Burn"),
    fundAsk:    idx("Fund Ask"),
    commitments:idx("commitments or ongoing"),
    fundNotes:  idx("Fundraising related Notes"),
    fathom:     idx("Fathom"),
    intervention: idx("T- Sprint Intervention"),
    tasks:      idx("Tasks"),
    problem:    idx("Current Problem"),
    nextStep:   idx("Suggested Next Step"),
    nextFive:   idx("next 5 Sprints"),
    csWorthy:   idx("Case study worthy"),
    csTheme:    idx("Case study theme"),
    tWorthy:    idx("Training worthy"),
    tTheme:     idx("Training Theme"),
    level:      idx("Level"),
  };

  let imported = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const startup = s(row[C.startup] as any);
    if (!startup) continue;
    // Skip metadata rows like "TEMPLATE" or section headers (e.g. row whose
    // startup col contains the cohort title like "ISB IVI 4.0" but has no
    // consultant or stage filled in).
    const sno = s(row[0] as any);
    if (sno && sno.toUpperCase() === "TEMPLATE") continue;
    if (startup.toUpperCase() === "TEMPLATE") continue;
    const consultant = s(row[C.consultant] as any);
    const stage = s(row[C.stage] as any);
    if (!consultant && !stage) continue; // section header / blank row
    // Defensive: the template row has Consultant="Consultant Name" — skip it
    if (consultant === "Consultant Name") continue;

    const founderEmail = `${startup.toLowerCase().replace(/[^a-z0-9]/g, "")}@${programName.toLowerCase()}.imported`;

    await upsertFounder({
      incubatorId: incId,
      name: consultant ?? "Unknown Founder",
      companyName: startup,
      email: founderEmail,
      stage,
      acceleratorProgram: programName,
      goalSetting: s(row[C.goal] as any),
      revenueLast12Months: parseRevenue(row[C.rev12] as any),
      revenueLastMonthMrr: parseRevenue(row[C.revMrr] as any),
      teamSize: n(row[C.teamSize] as any),
      keyStrength: s(row[C.strength] as any),
      gap: s(row[C.gap] as any),
      conceptAndSessions: C.concept >= 0 ? s(row[C.concept] as any) : null,
      mentorRecommendation: s(row[C.mentor] as any),
      marketAccess: s(row[C.market] as any),
      idealCustomerList: C.icp >= 0 ? s(row[C.icp] as any) : null,
      timelineForMarketAccess: s(row[C.marketTimeline] as any),
      observationsTs: s(row[C.observations] as any),
      recommendationForVc: C.recForVc >= 0 ? s(row[C.recForVc] as any) : null,
      previousFundraiseInr: n(row[C.prevFund] as any) as any,
      previousFundraiseOrgs: s(row[C.prevFundOrg] as any),
      currentBurn: s(row[C.burn] as any),
      fundAskCr: n(row[C.fundAsk] as any) as any,
      fundraiseCommitments: s(row[C.commitments] as any),
      fundraiseNotes: s(row[C.fundNotes] as any),
      fathomLink: s(row[C.fathom] as any),
      tSprintIntervention: C.intervention >= 0 ? s(row[C.intervention] as any) : null,
      tasks: C.tasks >= 0 ? s(row[C.tasks] as any) : null,
      currentProblem: s(row[C.problem] as any),
      suggestedNextStep: s(row[C.nextStep] as any),
      nextFiveSprints: s(row[C.nextFive] as any),
      caseStudyWorthy: asBool(row[C.csWorthy] as any),
      caseStudyTheme: s(row[C.csTheme] as any),
      trainingWorthy: asBool(row[C.tWorthy] as any),
      trainingTheme: s(row[C.tTheme] as any),
      level: s(row[C.level] as any),
    });
    imported++;
  }
  return imported;
}

// ─── Sprint tracking importer ─────────────────────────────────────────────
async function importSprintTracking(file: string) {
  const rows = readSheet(file);
  if (rows.length === 0) return 0;
  const headers = (rows[0] ?? []).map(h => String(h ?? "").replace(/\s+/g, " ").trim());
  const idx = (label: string) => headers.findIndex(h => h.toLowerCase() === label.toLowerCase());
  const I = {
    name: idx("Name"),
    firstName: idx("First Name"),
    industry: idx("Industry"),
    stage: idx("Stage of business"),
    program: idx("Program Name"),
    partner: idx("Partner Name"),
    host: idx("Sprint Host"),
    coHost: idx("Co-Host"),
    sessionNumber: idx("Sprint Session Number"),
    sprintCount: idx("Sprint count"),
    sessionType: idx("Session Type"),
    paymentStatus: idx("Payment Status"),
    billedTo: idx("Billed to"),
    sprintDate: idx("Sprint Date"),
    startTime: idx("Start Time"),
    endTime: idx("End Time"),
    duration: idx("Total Duration"),
    week: idx("Week"),
    month: idx("Month"),
    cyYear: idx("CY Year"),
    quarter: idx("Quarters"),
    price: idx("Price"),
    billNumber: idx("Bill number"),
    founder: idx("Founder"),
    email: idx("Email"),
    contact: idx("Contact"),
    founder2: idx("Founder 2"),
    email2: idx("Email 2"),
    contact2: idx("Contact 2"),
  };

  let imported = 0;
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const companyName = s(row[I.name] as any);
    if (!companyName) { skipped++; continue; }
    const programName = s(row[I.program] as any) ?? "Direct Channel";
    const host = s(row[I.host] as any);
    const coHost = s(row[I.coHost] as any);

    // Find or create the founder (companyName as key; not tied to an incubator if not ISB/JU)
    const founderEmail = s(row[I.email] as any)
                      ?? `${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}@tracking.imported`;
    const founderName = s(row[I.founder] as any) ?? s(row[I.firstName] as any) ?? "Unknown";

    // Attach to incubator only if program matches an allowed type
    let incubatorId: number | null = null;
    const pLow = programName.toLowerCase();
    if (pLow.includes("isb")) {
      const [i] = await db.select().from(incubatorsTable).where(eq(incubatorsTable.type, "isb")).limit(1);
      incubatorId = i?.id ?? null;
    } else if (pLow.includes("ju") || pLow.includes("jadavpur")) {
      const [i] = await db.select().from(incubatorsTable).where(eq(incubatorsTable.type, "ju")).limit(1);
      incubatorId = i?.id ?? null;
    }

    const [foundOrNew] = await db.select().from(foundersTable)
      .where(eq(foundersTable.companyName, companyName)).limit(1);
    const founderId = foundOrNew?.id ?? (await db.insert(foundersTable).values({
      incubatorId,
      name: founderName,
      email: founderEmail,
      contact: s(row[I.contact] as any),
      founder2Name: s(row[I.founder2] as any),
      founder2Email: s(row[I.email2] as any),
      founder2Contact: s(row[I.contact2] as any),
      companyName,
      industry: s(row[I.industry] as any),
      stage: s(row[I.stage] as any),
      acceleratorProgram: programName,
      partnerName: s(row[I.partner] as any),
    }).returning())[0].id;

    // Format the date — Excel may give a JS Date or a string
    const rawDate = row[I.sprintDate] as any;
    const scheduledDate = rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : s(rawDate);
    if (!scheduledDate) { skipped++; continue; }
    const formatTime = (v: any): string | null => {
      if (v instanceof Date) {
        return `${String(v.getUTCHours()).padStart(2,"0")}:${String(v.getUTCMinutes()).padStart(2,"0")}`;
      }
      return s(v);
    };

    const sprintNumber = n(row[I.sessionNumber] as any);
    // Idempotent: look up by founder + date + sprintNumber
    const [existing] = await db.select().from(sprintsTable)
      .where(and(
        eq(sprintsTable.founderId, founderId),
        eq(sprintsTable.scheduledDate, scheduledDate),
        eq(sprintsTable.sprintNumber, sprintNumber ?? -1),
      )).limit(1);

    const payload = {
      founderId,
      scheduledDate,
      scheduledTime: formatTime(row[I.startTime] as any),
      endTime: formatTime(row[I.endTime] as any),
      totalDuration: s(row[I.duration] as any),
      consultantName: host ?? "Unknown",
      sprintHost: host,
      coHost,
      status: "completed" as const,
      sprintNumber: sprintNumber ?? null,
      sessionType: s(row[I.sessionType] as any),
      paymentStatus: s(row[I.paymentStatus] as any),
      billedTo: s(row[I.billedTo] as any),
      billNumber: s(row[I.billNumber] as any),
      price: n(row[I.price] as any) as any,
      week: n(row[I.week] as any),
      month: n(row[I.month] as any),
      cyYear: n(row[I.cyYear] as any),
      quarter: s(row[I.quarter] as any),
    };
    if (existing) {
      await db.update(sprintsTable).set(payload).where(eq(sprintsTable.id, existing.id));
    } else {
      await db.insert(sprintsTable).values(payload);
    }
    imported++;
  }
  console.log(`  → ${imported} sprints imported, ${skipped} skipped`);
  return imported;
}

// ─── Demo seed entry ──────────────────────────────────────────────────────
async function ensureDemoIncubator() {
  const [existing] = await db.select().from(incubatorsTable).where(eq(incubatorsTable.type, "demo")).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(incubatorsTable).values({
    name: "Demo Program",
    type: "demo",
    description: "Reference / demo data — use to showcase the platform to prospective partners.",
  }).returning();
  return created;
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding summary sheets…\n");

  const isb = await getOrCreateIncubator("ISB IVI 4.0", "isb",
    "Indian School of Business — Venture Incubation, cohort 4.0");
  console.log(`✓ ISB incubator: id=${isb.id}`);

  const ju = await getOrCreateIncubator("JU Cohort", "ju",
    "Jadavpur University startup cohort");
  console.log(`✓ JU incubator:  id=${ju.id}`);

  const demo = await ensureDemoIncubator();
  console.log(`✓ Demo incubator: id=${demo.id}`);

  console.log("\n📊 Importing ISB Summary Sheet…");
  const isbCount = await importSummarySheet(ISB_FILE, "ISB", isb.id);
  console.log(`  → ${isbCount} ISB ventures imported.`);

  console.log("\n📊 Importing JU Summary Sheet…");
  const juCount = await importSummarySheet(JU_FILE, "JU", ju.id);
  console.log(`  → ${juCount} JU ventures imported.`);

  console.log("\n📅 Importing Sheet Tracking…");
  await importSprintTracking(TRACKING_FILE);

  console.log("\n✅ Seed complete.");
}

main().then(() => process.exit(0)).catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
