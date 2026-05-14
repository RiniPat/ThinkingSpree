import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

router.get("/auth/me", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  if (!email.endsWith("@thinkingspree.com")) {
    res.status(403).json({ error: "Only Thinking Spree work email addresses are allowed" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    req.session.userId = user.id;
   req.session.save((err) => {
     if (err) {
       req.log.error({ err }, "Failed to persist session");
       res.status(500).json({ error: "Session save failed" });
       return;
     }
     res.json({
       id: user.id,
       email: user.email,
       name: user.name,
       role: user.role,
     });
   });
  } catch (err) {
    req.log.error({ err }, "Error during login");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session?.destroy(() => {
    res.json({ success: true });
  });
});

router.post("/auth/signup", async (req, res) => {
  const { email, password, name } = req.body as { email: string; password: string; name: string };
  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password, and name are all required" });
    return;
  }
  if (!email.endsWith("@thinkingspree.com")) {
    res.status(403).json({ error: "Only @thinkingspree.com emails are allowed to register" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      email, name, passwordHash, role: "consultant",
    }).returning();
    req.session.userId = user.id;
   req.session.save((err) => {
     if (err) {
       req.log.error({ err }, "Failed to persist session");
       res.status(500).json({ error: "Session save failed" });
       return;
     }
     res.json({
       id: user.id,
       email: user.email,
       name: user.name,
       role: user.role,
     });
   });
  } catch (err) {
    req.log.error({ err }, "Error during signup");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
