import { Router } from 'express';
import {
  favorite,
  generateRoleImage,
  getRecommendations,
  listFavorites,
  swipe,
  unfavorite,
} from '../controllers/matchController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', getRecommendations);
router.get('/favorites', listFavorites);
router.post('/favorites', favorite);
router.delete('/favorites/:cardId', unfavorite);
router.post('/:cardId/image', generateRoleImage);
router.post('/swipes', swipe);

export default router;