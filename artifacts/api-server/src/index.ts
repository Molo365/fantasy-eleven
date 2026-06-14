import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const ADMIN_EMAILS = ["domenicg@gmx.com"];

async function ensureAdminRoles() {
  for (const email of ADMIN_EMAILS) {
    const result = await db
      .update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.email, email));
    if ((result as unknown as { rowCount?: number }).rowCount) {
      logger.info({ email }, "Ensured admin role on startup");
    }
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  ensureAdminRoles().catch((e) =>
    logger.error({ err: e }, "Failed to ensure admin roles"),
  );
});
