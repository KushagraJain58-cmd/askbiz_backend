let express = require("express");
let verifyToken = require("../middelwares/jwt").verifyToken;
let verifyUser = require("../middelwares/jwt").verifyUser;
let verifyAdmin = require("../middelwares/jwt").verifyAdmin;

const aiController = require("../controllers/ai/aiController");

let aiRouter = express.Router();

// User routes
aiRouter.get('/history', verifyToken, verifyUser, aiController.getHistory);
aiRouter.delete('/history', verifyToken, verifyUser, aiController.clearHistory);
aiRouter.post('/feedback', verifyToken, verifyUser, aiController.submitFeedback);

// Admin routes
aiRouter.post('/knowledge', verifyToken, verifyAdmin, aiController.addKnowledge);
aiRouter.get('/analytics', verifyToken, verifyAdmin, aiController.getAnalytics);

module.exports = aiRouter;
