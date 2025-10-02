import { Router } from 'express';
import { getProfile, updateProfile, uploadAvatar } from '../controllers/profileController.js';
import { authenticate } from '../middleware/auth.js';
import { avatarUpload } from '../middleware/avatarUpload.js';

const router = Router();

router.use(authenticate);
router.get('/', getProfile);
router.put('/', updateProfile);
router.post('/avatar', avatarUpload.single('avatar'), uploadAvatar);

export default router;
