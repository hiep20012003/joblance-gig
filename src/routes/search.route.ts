import express, { Router } from 'express';
import { gigController } from '@gigs/controllers/gig.controller';
import { validate } from '@hiep20012003/joblance-shared';
import { searchParamsSchema } from '@gigs/schemas/search.schema';

class SearchRoutes {
  private readonly router: Router;
  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get('/gigs/search/:gigId', gigController.getGigById);
    this.router.post('/gigs/search', validate(searchParamsSchema), gigController.search);
    return this.router;
  }
}

export const searchRoutes: SearchRoutes = new SearchRoutes();
