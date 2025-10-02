import { Router } from 'express';
import { establishSession, verifyToken } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/verify', verifyToken);
router.post('/session', authenticate, establishSession);

export default router;
