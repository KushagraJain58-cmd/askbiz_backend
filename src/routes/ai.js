let express = require("express");
let verifyToken = require("../middelwares/jwt").verifyToken;
let verifyUser = require("../middelwares/jwt").verifyUser;
let verifyAdmin = require("../middelwares/jwt").verifyAdmin;

const aiController = require("../controllers/ai/aiController");

let aiRouter = express.Router();

// Chat sessions (Claude-style multiple conversations)
aiRouter.get('/sessions', verifyToken, verifyUser, aiController.getSessions);
aiRouter.post('/sessions', verifyToken, verifyUser, aiController.createChatSession);
aiRouter.get('/sessions/:sessionId', verifyToken, verifyUser, aiController.getSessionMessages);
aiRouter.patch('/sessions/:sessionId', verifyToken, verifyUser, aiController.renameChatSession);
aiRouter.delete('/sessions/:sessionId', verifyToken, verifyUser, aiController.deleteChatSession);
aiRouter.delete('/sessions/:sessionId/messages', verifyToken, verifyUser, aiController.clearHistory);

// Feedback
aiRouter.post('/feedback', verifyToken, verifyUser, aiController.submitFeedback);

// Admin routes
aiRouter.post('/knowledge', verifyToken, verifyAdmin, aiController.addKnowledge);
aiRouter.get('/analytics', verifyToken, verifyAdmin, aiController.getAnalytics);

module.exports = aiRouter;
