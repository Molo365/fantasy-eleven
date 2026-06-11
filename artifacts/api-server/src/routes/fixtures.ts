import { Router, type IRouter } from "express";
import { GetLiveFixturesResponse } from "@workspace/api-zod";
import { getWorldCupFixtures } from "../lib/apiSports";

const router: IRouter = Router();

const WC_SEASON = 2026;

router.get("/fixtures", async (req, res): Promise<void> => {
  try {
    const fixtures = await getWorldCupFixtures(WC_SEASON);
    res.json(GetLiveFixturesResponse.parse(fixtures));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch live fixtures from API-Sports");
    res.status(502).json({ error: "Failed to fetch fixtures" });
  }
});

export default router;
