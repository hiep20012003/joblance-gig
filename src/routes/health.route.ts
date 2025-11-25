import { healthController } from "@gigs/controllers/health.controller";
import express, { Router } from "express";

class HealthRoutes {
  private readonly router: Router;
  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get("/gig-health", healthController.health);
    return this.router;
  }
}

export const healthRoutes: HealthRoutes = new HealthRoutes();
