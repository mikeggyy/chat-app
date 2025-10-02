import { Router } from 'express';
import {
  clearConversationMessages,
  deleteConversation,
  generateSuggestions,
  getConversationMessages,
  listConversations,
  sendMessage,
  updateConversation,
} from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', listConversations);
router.get('/:conversationId/messages', getConversationMessages);
router.post('/:conversationId/messages', (req, res, next) => {
  req.body = {
    ...req.body,
    conversationId: req.params.conversationId,
  };
  sendMessage(req, res, next);
});
router.delete('/:conversationId/messages', clearConversationMessages);
router.patch('/:conversationId', updateConversation);
router.delete('/:conversationId', deleteConversation);
router.post('/:conversationId/suggestions', generateSuggestions);

export default router;

