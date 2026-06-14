import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, teamsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const ADMIN_EMAILS = new Set(["domenicg@gmx.com"]);

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, email, password, displayName } = req.body as Record<string, string>;
  if (!username || !email || !password || !displayName) {
    res.status(400).json({ error: "All fields required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const [existingUsername] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username.toLowerCase()));
  if (existingUsername) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedEmail = email.toLowerCase();
  const role = ADMIN_EMAILS.has(normalizedEmail) ? "admin" : "user";
  const [user] = await db
    .insert(usersTable)
    .values({
      username: username.toLowerCase(),
      email: normalizedEmail,
      passwordHash,
      displayName,
      role,
    })
    .returning();
  req.session.userId = user.id;
  req.log.info({ userId: user.id }, "User registered");
  // Auto-create a team for the new user so they start with £100m budget immediately
  const [newTeam] = await db.insert(teamsTable).values({
    userId: user.id,
    name: `${displayName}'s Team`,
    managerName: displayName,
    budget: 100,
  }).returning({ id: teamsTable.id });
  res.status(201).json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    teamId: newTeam?.id ?? null,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as Record<string, string>;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));
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
  req.log.info({ userId: user.id }, "User logged in");
  let [loginTeam] = await db.select({ id: teamsTable.id }).from(teamsTable).where(eq(teamsTable.userId, user.id));
  // Back-fill: create a team for users who registered before auto-creation was added
  if (!loginTeam) {
    [loginTeam] = await db.insert(teamsTable).values({
      userId: user.id,
      name: `${user.displayName}'s Team`,
      managerName: user.displayName,
      budget: 100,
    }).returning({ id: teamsTable.id });
    req.log.info({ userId: user.id, teamId: loginTeam?.id }, "Auto-created missing team on login");
  }
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    teamId: loginTeam?.id ?? null,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, "Session destroy error");
      res.status(500).json({ error: "Could not log out" });
      return;
    }
    res.clearCookie("fanta11.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const [team] = await db.select({ id: teamsTable.id }).from(teamsTable).where(eq(teamsTable.userId, userId));
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    teamId: team?.id ?? null,
  });
});

export default router;
