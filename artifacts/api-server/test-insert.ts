// Temporary diagnostic script — delete after debugging
import { db, playersTable } from "@workspace/db";

async function main() {
  console.log("Testing Drizzle insert with imageUrl + crestUrl...");
  try {
    const result = await db.insert(playersTable).values({
      externalId: 99999,
      name: "Test Player",
      position: "GK",
      club: "Arsenal",
      clubShortName: "ARS",
      nationality: "premier_league",
      price: 5.5,
      totalPoints: 0,
      imageUrl: "https://resources.premierleague.com/premierleague/photos/players/110x140/p154561.png",
      crestUrl: "https://resources.premierleague.com/premierleague/badges/70/t3.png",
      cachedFromApi: true,
      cachedAt: new Date(),
    }).returning({ id: playersTable.id });
    console.log("INSERT succeeded:", result);
    // Clean up
    const { eq } = await import("drizzle-orm");
    await db.delete(playersTable).where(eq(playersTable.externalId, 99999));
    console.log("Cleanup done.");
  } catch (err) {
    console.error("INSERT FAILED:", err);
  }
  process.exit(0);
}

main();
