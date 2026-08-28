import { and, eq } from "drizzle-orm";
import { db, teamsTable } from "@workspace/db";

type TeamExecutor = Pick<typeof db, "select" | "insert">;

type CompetitionTeamOptions = {
  teamName?: string;
};

function defaultTeamName(managerName: string, competitionKey: string): string {
  if (competitionKey === "premier-league") return `${managerName}'s Team`;
  if (competitionKey === "serie-a") return `${managerName}'s Serie A Team`;
  return `${managerName}'s ${competitionKey} Team`;
}

export async function getOrCreateCompetitionTeam(
  executor: TeamExecutor,
  userId: number,
  competitionKey: string,
  managerName: string,
  options: CompetitionTeamOptions = {},
) {
  const [existing] = await executor
    .select()
    .from(teamsTable)
    .where(and(
      eq(teamsTable.userId, userId),
      eq(teamsTable.competitionKey, competitionKey),
    ));
  if (existing) return existing;

  const [created] = await executor
    .insert(teamsTable)
    .values({
      userId,
      competitionKey,
      name: options.teamName?.trim() || defaultTeamName(managerName, competitionKey),
      managerName,
      budget: 100,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [concurrent] = await executor
    .select()
    .from(teamsTable)
    .where(and(
      eq(teamsTable.userId, userId),
      eq(teamsTable.competitionKey, competitionKey),
    ));
  if (!concurrent) {
    throw new Error(`Could not resolve ${competitionKey} team for user ${userId}`);
  }
  return concurrent;
}