import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { db, usersTable, teamsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { getOrCreateCompetitionTeam } from "../lib/competitionTeam";

const ADMIN_EMAILS = new Set(["domenicg@gmx.com"]);

const router: IRouter = Router();

async function getAuthTeams(userId: number) {
  return db
    .select({
      id: teamsTable.id,
      competitionKey: teamsTable.competitionKey,
      name: teamsTable.name,
      managerName: teamsTable.managerName,
    })
    .from(teamsTable)
    .where(eq(teamsTable.userId, userId))
    .orderBy(asc(teamsTable.id));
}

async function serializeAuthUser(user: typeof usersTable.$inferSelect) {
  let teams = await getAuthTeams(user.id);
  if (teams.length === 0) {
    await getOrCreateCompetitionTeam(db, user.id, "premier-league", user.displayName);
    teams = await getAuthTeams(user.id);
  }
  const primaryTeam = teams.find((team) => team.competitionKey === "premier-league") ?? teams[0] ?? null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    teamId: primaryTeam?.id ?? null,
    teams,
  };
}

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
  await getOrCreateCompetitionTeam(db, user.id, "premier-league", displayName);
  res.status(201).json(await serializeAuthUser(user));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  console.log("LOGIN ROUTE HIT", req.method, req.path);
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
  res.json(await serializeAuthUser(user));
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
  res.json(await serializeAuthUser(user));
});

export default router;
