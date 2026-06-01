import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import playersRouter from "./players";
import teamsRouter from "./teams";
import leaguesRouter from "./leagues";
import gameweeksRouter from "./gameweeks";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(playersRouter);
router.use(teamsRouter);
router.use(leaguesRouter);
router.use(gameweeksRouter);
router.use(dashboardRouter);

export default router;
