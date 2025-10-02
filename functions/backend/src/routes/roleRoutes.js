import { Router } from 'express';
import { createRole, getRole, listRoles, updateRole } from '../controllers/roleController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', listRoles);
router.post('/', createRole);
router.get('/:id', getRole);
router.put('/:id', updateRole);

export default router;
