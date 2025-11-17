import { Router } from 'express';
import { seedGigs, deleteSeededGigs } from '@gigs/controllers/seed.controller';

const router = Router();

router.post('/gigs', seedGigs);
router.delete('/gigs', deleteSeededGigs);

export default router;
