let AIChatSession = require('../../models/aiChatSession');
let KnowledgeChunk = require('../../models/knowledgeChunk');
let AIQueryLog = require('../../models/aiQueryLog');
let { ingestChunk } = require('../../services/ai/ragService');
let {
    clearHistory,
    listSessions,
    createSession,
    deleteSession,
    renameSession,
    findOwnedSession,
    MAX_SESSIONS,
} = require('../../services/ai/chatHistoryService');
let response = require('../../../utils/constants/responseFunctions');
let statusCode = require('../../../utils/constants/responseCodes');
let { catchAsyncError } = require('../../../utils/constants/generateError');

/**
 * GET /api/v1/ai/sessions
 * Lists the user's chat sessions for the sidebar (most recent first).
 */
exports.getSessions = catchAsyncError(async (req, res) => {
    const sessions = await listSessions(req.user.id.toString());

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "AI chat sessions fetched successfully!", {
        sessions,
        maxSessions: MAX_SESSIONS,
    });
});

/**
 * POST /api/v1/ai/sessions
 * Starts a new chat. If the user is already at the session cap, the least
 * recently active session is permanently removed (Mongo + Redis).
 */
exports.createChatSession = catchAsyncError(async (req, res) => {
    const session = await createSession(req.user.id.toString());

    return response.responseHandlerWithData(res, true, statusCode.CREATED, "New chat started!", { session });
});

/**
 * GET /api/v1/ai/sessions/:sessionId
 * Returns the messages of ONE session, including the entity cards that were
 * attached to each assistant reply.
 */
exports.getSessionMessages = catchAsyncError(async (req, res) => {
    const session = await findOwnedSession(
        req.user.id.toString(),
        req.params.sessionId,
        'messages title lastActive totalQueries'
    );

    if (!session) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, "Chat not found!");
    }

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "AI chat history fetched successfully!", {
        sessionId: session._id.toString(),
        title: session.title,
        messages: (session.messages || []).slice(-50),
        totalQueries: session.totalQueries,
        lastActive: session.lastActive,
    });
});

/**
 * PATCH /api/v1/ai/sessions/:sessionId
 * Manually renames a chat. Overrides the auto-derived title going forward.
 */
exports.renameChatSession = catchAsyncError(async (req, res) => {
    const { title } = req.body;

    if (!title || !String(title).trim()) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "Title cannot be empty!");
    }

    const updated = await renameSession(req.user.id.toString(), req.params.sessionId, title);

    if (!updated) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, "Chat not found!");
    }

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Chat renamed successfully!", { session: updated });
});

/**
 * DELETE /api/v1/ai/sessions/:sessionId
 * Permanently deletes one session everywhere — Mongo document and Redis cache.
 */
exports.deleteChatSession = catchAsyncError(async (req, res) => {
    const removed = await deleteSession(req.user.id.toString(), req.params.sessionId);

    if (!removed) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, "Chat not found!");
    }

    return response.responseHandlerWithMessage(res, true, statusCode.SUCCESS, "Chat deleted successfully!");
});

/**
 * DELETE /api/v1/ai/sessions/:sessionId/messages
 * Empties one session's messages but keeps the session itself.
 */
exports.clearHistory = catchAsyncError(async (req, res) => {
    const session = await findOwnedSession(req.user.id.toString(), req.params.sessionId, '_id');

    if (!session) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, "Chat not found!");
    }

    await clearHistory(req.user.id.toString(), req.params.sessionId, true);
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
