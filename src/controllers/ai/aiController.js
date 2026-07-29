let AIChatSession = require('../../models/aiChatSession');
let KnowledgeChunk = require('../../models/knowledgeChunk');
let AIQueryLog = require('../../models/aiQueryLog');
let { ingestChunk } = require('../../services/ai/ragService');
let { clearHistory } = require('../../services/ai/chatHistoryService');
let response = require('../../../utils/constants/responseFunctions');
let statusCode = require('../../../utils/constants/responseCodes');
let { catchAsyncError } = require('../../../utils/constants/generateError');

/**
 * GET /api/v1/ai/history
 * Returns the user's persisted AI chat history.
 */
exports.getHistory = catchAsyncError(async (req, res) => {
    const session = await AIChatSession.findOne({ userId: req.user.id })
        .select('messages lastActive totalQueries')
        .lean();

    if (!session) {
        return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "AI chat history fetched successfully!", {
            messages: [],
            totalQueries: 0,
        });
    }

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "AI chat history fetched successfully!", {
        messages: session.messages.slice(-50),
        totalQueries: session.totalQueries,
        lastActive: session.lastActive,
    });
});

/**
 * DELETE /api/v1/ai/history
 * Clears the user's chat history from both Redis and MongoDB.
 */
exports.clearHistory = catchAsyncError(async (req, res) => {
    await clearHistory(req.user.id.toString(), true);
    return response.responseHandlerWithMessage(res, true, statusCode.SUCCESS, "AI chat history cleared successfully!");
});

/**
 * POST /api/v1/ai/feedback
 * Submit thumbs up/down for the last AI response.
 */
exports.submitFeedback = catchAsyncError(async (req, res) => {
    const { feedback } = req.body;

    if (!['positive', 'negative'].includes(feedback)) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "Invalid feedback value!");
    }

    const lastLog = await AIQueryLog.findOne({ userId: req.user.id }).sort({ createdAt: -1 });

    if (lastLog) {
        lastLog.feedback = feedback;
        await lastLog.save();
    }

    return response.responseHandlerWithMessage(res, true, statusCode.SUCCESS, "Feedback saved successfully!");
});

/**
 * ADMIN ONLY: POST /api/v1/ai/knowledge
 * Ingest a new knowledge chunk into the RAG pipeline.
 */
exports.addKnowledge = catchAsyncError(async (req, res) => {
    const { title, content, category, tags, language } = req.body;

    if (!title || !content || !category) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "title, content, and category are required!");
    }

    const chunk = await KnowledgeChunk.create({ title, content, category, tags, language });

    try {
        const pineconeId = await ingestChunk(chunk._id, title, content, category, tags);
        return response.responseHandlerWithData(res, true, statusCode.CREATED, "Knowledge chunk ingested successfully!", {
            chunkId: chunk._id,
            pineconeId,
        });
    } catch (error) {
        // Chunk is stored in MongoDB with isEmbedded=false; embedding can be retried
        console.error('[Knowledge Ingest] Pinecone error:', error.message);
        return response.responseHandlerWithData(res, true, statusCode.CREATED, "Knowledge chunk saved, but embedding failed. Re-run ingestion.", {
            chunkId: chunk._id,
            pineconeId: null,
        });
    }
});

/**
 * ADMIN ONLY: GET /api/v1/ai/analytics
 * Basic AI usage analytics.
 */
exports.getAnalytics = catchAsyncError(async (req, res) => {
    const [totalQueries, feedbackCounts, topUsers, avgDuration] = await Promise.all([
        AIQueryLog.countDocuments(),
        AIQueryLog.aggregate([
            { $group: { _id: '$feedback', count: { $sum: 1 } } },
        ]),
        AIQueryLog.aggregate([
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]),
        AIQueryLog.aggregate([
            { $match: { durationMs: { $gt: 0 } } },
            { $group: { _id: null, avgMs: { $avg: '$durationMs' } } },
        ]),
    ]);

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "AI analytics fetched successfully!", {
        totalQueries,
        feedbackCounts,
        topUsers,
        avgDurationMs: avgDuration[0]?.avgMs || 0,
    });
});
