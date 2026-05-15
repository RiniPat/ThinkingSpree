import { Router } from "express";
import multer from "multer";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ensureCoreIncubators, importSummarySheet, importSprintTracking,
  readUploadedBuffer, detectSheetKind, type SheetKind,
} from "@workspace/importer";

const router = Router();

// In-memory storage; max 20 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.includes("sheet")
      || file.mimetype.includes("excel")
      || file.originalname.toLowerCase().endsWith(".xlsx");
    if (ok) cb(null, true);
    else cb(new Error("Only .xlsx files are accepted") as any, false);
  },
});

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!me || me.role !== "admin") { res.status(403).json({ error: "Admin only" }); return false; }
  return true;
}

/**
 * POST /admin/import
 * multipart/form-data:
 *   file: the xlsx file
 *   kind: "isb-summary" | "ju-summary" | "sheet-tracking" | "auto" (default)
 *
 * Returns { kind, result } where result has counts (imported/skipped/existing).
 */
router.post("/admin/import", upload.single("file"), async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  try {
    const sheets = readUploadedBuffer(req.file.buffer);
    const sheetNames = Object.keys(sheets);
    if (sheetNames.length === 0) {
      res.status(400).json({ error: "No sheets found in the workbook" });
      return;
    }
    const firstSheetRows = sheets[sheetNames[0]];

    const requestedKind = String(req.body.kind ?? "auto") as SheetKind | "auto";
    const kind: SheetKind = requestedKind === "auto"
      ? detectSheetKind(firstSheetRows)
      : requestedKind;

    if (kind === "unknown") {
      res.status(400).json({
        error: "Could not detect sheet type. Pass `kind=isb-summary`, `ju-summary`, or `sheet-tracking`.",
        availableSheets: sheetNames,
      });
      return;
    }

    const { isb, ju } = await ensureCoreIncubators();
    let result: any;
    if (kind === "isb-summary") {
      result = await importSummarySheet(firstSheetRows, "ISB", isb.id);
    } else if (kind === "ju-summary") {
      result = await importSummarySheet(firstSheetRows, "JU", ju.id);
    } else {
      result = await importSprintTracking(firstSheetRows);
    }
    req.log.info({ kind, result }, "Import completed");
    res.json({ kind, result, fileName: req.file.originalname });
  } catch (err: any) {
    req.log.error({ err }, "Import failed");
    res.status(500).json({ error: err?.message ?? "Import failed" });
  }
});

export default router;
