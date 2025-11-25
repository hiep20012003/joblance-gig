import { Application } from "express";
import { healthRoutes } from "@gigs/routes/health.route";
import { gigRoutes } from "@gigs/routes/gig.route";
import { createVerifyGatewayRequest } from "@hiep20012003/joblance-shared";
import { config } from "@gigs/config";
import { searchRoutes } from "@gigs/routes/search.route";
import seedRoutes from "@gigs/routes/seed.route";

const BASE_URL = "/api/v1";

export const appRoutes = (app: Application) => {
  app.use("", healthRoutes.routes());
  app.use(BASE_URL, createVerifyGatewayRequest(`${config.GATEWAY_SECRET_KEY}`), searchRoutes.routes());
  app.use(BASE_URL, createVerifyGatewayRequest(`${config.GATEWAY_SECRET_KEY}`), gigRoutes.routes());
  app.use("/seed", seedRoutes);
};
