const { streamAIResponse } = require('./src/services/ai/aiService');
const { aiRateLimit } = require('./src/middelwares/aiRateLimit');
const { clearHistory, resolveSession } = require('./src/services/ai/chatHistoryService');
const AIQueryLog = require('./src/models/aiQueryLog');

/**
 * Register AI assistant socket events on an authenticated socket.
 * Called from index.js inside the io.on("connection") handler, after the
 * JWT has been verified and socket.data has been populated.
 *
 * Client emits:  ai:query { query, sessionId? }, ai:clear_history { sessionId },
 *                ai:feedback { feedback }
 * Server emits:  ai:start { remaining, sessionId }, ai:chunk { text, sessionId },
 *                ai:done { fullResponse, entities, sessionId },
 *                ai:error { message, sessionId?, rateLimited?, retryAfter? },
 *                ai:history_cleared { sessionId }, ai:feedback_received
 *
 * sessionId is always echoed back so the client can attach streamed output to
 * the correct conversation even if the user switched chats mid-stream.
 */
function registerAIHandlers(socket) {
  const userId = socket.data.userId?.toString();
  const userRole = socket.data.accountType;

  // AI assistant is for platform users only (not admin panel sockets)
  if (!userId || userRole === 'Admin') return;

  let aiBusy = false;

  socket.on('ai:query', async ({ query, sessionId } = {}) => {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      socket.emit('ai:error', { message: 'Query cannot be empty.' });
      return;
    }

    if (query.length > 2000) {
      socket.emit('ai:error', { message: 'Query is too long. Please keep it under 2000 characters.' });
      return;
    }

    if (aiBusy) {
      socket.emit('ai:error', { message: 'Please wait for the current response to finish.' });
      return;
    }

    let rateLimitResult;
    try {
      rateLimitResult = await aiRateLimit(userId);
    } catch (err) {
      console.error(`[AI Socket] Rate limit check failed for ${userId}:`, err.message);
      socket.emit('ai:error', { message: 'Something went wrong. Please try again.' });
      return;
    }

    if (!rateLimitResult.allowed) {
      socket.emit('ai:error', {
        message: rateLimitResult.message,
        retryAfter: rateLimitResult.retryAfter,
        rateLimited: true,
      });
      return;
    }

    aiBusy = true;

    // Resolve (or lazily create) the conversation this query belongs to, so
    // history stays scoped to one session. The id is echoed back on every
    // event so the client can attach the reply to the right conversation.
    let activeSessionId;
    try {
      activeSessionId = await resolveSession(userId, sessionId);
    } catch (err) {
      aiBusy = false;
      console.error(`[AI Socket] Session resolve failed for ${userId}:`, err.message);
      socket.emit('ai:error', { message: 'Could not open that chat. Please try again.' });
      return;
    }

    socket.emit('ai:start', {
      remaining: rateLimitResult.remaining,
      sessionId: activeSessionId,
    });

    await streamAIResponse({
      userId,
      sessionId: activeSessionId,
      userRole,
      query: query.trim(),
      onChunk: (text) => socket.emit('ai:chunk', { text, sessionId: activeSessionId }),
      onDone: (fullResponse, entities = []) => {
        aiBusy = false;
        socket.emit('ai:done', { fullResponse, entities, sessionId: activeSessionId });
      },
      onError: (error) => {
        aiBusy = false;
        console.error(`[AI Socket] Error for user ${userId}:`, error.message);
        socket.emit('ai:error', {
          message: 'Something went wrong. Please try again.',
          sessionId: activeSessionId,
        });
      },
    });
  });

  socket.on('ai:clear_history', async ({ sessionId } = {}) => {
    if (!sessionId) return;
    try {
      await clearHistory(userId, sessionId, true);
      socket.emit('ai:history_cleared', { sessionId });
    } catch (error) {
      console.error('[AI Socket] Clear history error:', error.message);
      socket.emit('ai:error', { message: 'Failed to clear history.' });
    }
  });

  socket.on('ai:feedback', async ({ feedback } = {}) => {
    if (!['positive', 'negative'].includes(feedback)) return;

    try {
      // Attach feedback to the user's most recent query log
      const lastLog = await AIQueryLog.findOne({ userId }).sort({ createdAt: -1 });

      if (lastLog && !lastLog.feedback) {
        lastLog.feedback = feedback;
        await lastLog.save();
      }

      socket.emit('ai:feedback_received');
    } catch (error) {
      console.error('[AI Feedback] Error:', error.message);
    }
  });
}

module.exports = { registerAIHandlers };
