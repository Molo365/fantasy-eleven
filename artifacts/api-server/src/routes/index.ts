import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import playersRouter from "./players";
import teamsRouter from "./teams";
import leaguesRouter from "./leagues";
import gameweeksRouter from "./gameweeks";
import fixturesRouter from "./fixtures";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(playersRouter);
router.use(teamsRouter);
router.use(leaguesRouter);
router.use(gameweeksRouter);
router.use(fixturesRouter);
router.use(dashboardRouter);
router.use(adminRouter);

export default router;
