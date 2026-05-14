import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import incubatorsRouter from "./incubators";
import foundersRouter from "./founders";
import sprintsRouter from "./sprints";
import emailsRouter from "./emails";
import calendarRouter from "./calendar";
import summaryRouter from "./summary";
import googleRouter from "./google";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(incubatorsRouter);
router.use(foundersRouter);
router.use(sprintsRouter);
router.use(emailsRouter);
router.use(calendarRouter);
router.use(summaryRouter);
router.use(googleRouter);

export default router;
