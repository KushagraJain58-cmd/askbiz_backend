const { streamAIResponse } = require('./src/services/ai/aiService');
const { aiRateLimit } = require('./src/middelwares/aiRateLimit');
const { clearHistory } = require('./src/services/ai/chatHistoryService');
const AIQueryLog = require('./src/models/aiQueryLog');

/**
 * Register AI assistant socket events on an authenticated socket.
 * Called from index.js inside the io.on("connection") handler, after the
 * JWT has been verified and socket.data has been populated.
 *
 * Client emits:  ai:query { query }, ai:clear_history, ai:feedback { feedback }
 * Server emits:  ai:start { remaining }, ai:chunk { text }, ai:done { fullResponse, entities },
 *                ai:error { message, rateLimited?, retryAfter? }, ai:history_cleared,
 *                ai:feedback_received
 */
function registerAIHandlers(socket) {
  const userId = socket.data.userId?.toString();
  const userRole = socket.data.accountType;

  // AI assistant is for platform users only (not admin panel sockets)
  if (!userId || userRole === 'Admin') return;

  let aiBusy = false;

  socket.on('ai:query', async ({ query } = {}) => {
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
    socket.emit('ai:start', { remaining: rateLimitResult.remaining });

    await streamAIResponse({
      userId,
      userRole,
      query: query.trim(),
      onChunk: (text) => socket.emit('ai:chunk', { text }),
      onDone: (fullResponse, entities = []) => {
        aiBusy = false;
        socket.emit('ai:done', { fullResponse, entities });
      },
      onError: (error) => {
        aiBusy = false;
        console.error(`[AI Socket] Error for user ${userId}:`, error.message);
        socket.emit('ai:error', {
          message: 'Something went wrong. Please try again.',
        });
      },
    });
  });

  socket.on('ai:clear_history', async () => {
    try {
      await clearHistory(userId, true);
      socket.emit('ai:history_cleared');
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
