import { Router } from 'express';
import searchController from '../controllers/SearchController';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

// Secure all search endpoints
router.use(authMiddleware);

router.get('/', searchController.search);
router.get('/recent', searchController.getRecent);
router.get('/trending', searchController.getTrending);
router.get('/suggestions', searchController.getSuggestions);

export default router;
