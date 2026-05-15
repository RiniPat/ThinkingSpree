import { Router } from "express";
import { db, sprintsTable, emailLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/emails/send", async (req, res) => {
  const { to, subject, body, sprintId, emailType } = req.body;
  if (!to || !subject || !body || !sprintId || !emailType) {
    res.status(400).json({ error: "to, subject, body, sprintId and emailType are required" });
    return;
  }
  try {
    // Log the email
    await db.insert(emailLogsTable).values({
      sprintId,
      emailType,
      toEmail: to,
      subject,
      body,
      messageId: `msg_${Date.now()}`,
    });

    // Update sprint with sent timestamp
    const now = new Date();
    if (emailType === "pre_sprint") {
      await db.update(sprintsTable).set({ preEmailSentAt: now }).where(eq(sprintsTable.id, sprintId));
    } else if (emailType === "post_sprint") {
      await db.update(sprintsTable).set({ postEmailSentAt: now, status: "completed" }).where(eq(sprintsTable.id, sprintId));
    }

    req.log.info({ sprintId, emailType, to }, "Email sent (simulated)");

    res.json({
      success: true,
      messageId: `msg_${Date.now()}`,
      sentAt: now.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error sending email");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
