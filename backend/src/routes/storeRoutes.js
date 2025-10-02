import { Router } from 'express';
import { listStoreItems, purchaseItem } from '../controllers/storeController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', listStoreItems);
router.post('/purchase', purchaseItem);

export default router;
