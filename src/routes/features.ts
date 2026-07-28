import { Router } from 'express';
import { getFeatureFlags } from '../controllers/FeatureController';

const router = Router();

router.get('/', getFeatureFlags);

export default router;
