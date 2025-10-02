import { Router } from 'express';
import authRoutes from './authRoutes.js';
import chatRoutes from './chatRoutes.js';
import matchRoutes from './matchRoutes.js';
import profileRoutes from './profileRoutes.js';
import roleRoutes from './roleRoutes.js';
import storeRoutes from './storeRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/chats', chatRoutes);
router.use('/match', matchRoutes);
router.use('/profile', profileRoutes);
router.use('/ai-roles', roleRoutes);
router.use('/store', storeRoutes);

export default router;
