/**
 * Manages per-user AI chat history in Redis (ioredis) for fast access within
 * a session. History is also persisted to MongoDB (aiChatSession) for
 * long-term storage; Redis is repopulated from MongoDB after a restart.
 */

const redisClient = require('../../config/redis');
const AIChatSession = require('../../models/aiChatSession');
const { config } = require('../../../utils/config');

const MAX_TURNS = config.ai_chat_history_max_turns; // user+assistant pairs
const MAX_MESSAGES = MAX_TURNS * 2;
const TTL = config.ai_chat_history_ttl;

function redisKey(userId) {
  return `ai:chat:${userId}`;
}

/**
 * The Anthropic API requires the first message to be from the user. After
 * trimming, the window can start with an assistant message — drop leaders.
 */
function normalizeHistory(messages) {
  const firstUser = messages.findIndex(m => m.role === 'user');
  return firstUser === -1 ? [] : messages.slice(firstUser);
}

/**
 * Get the most recent messages for a user (oldest first).
 * Falls back to MongoDB if Redis is empty (e.g. after a server restart).
 */
async function getChatHistory(userId) {
  try {
    const raw = await redisClient.lrange(redisKey(userId), 0, MAX_MESSAGES - 1);
    if (raw && raw.length > 0) {
      // lpush stores newest first — reverse to chronological order
      return normalizeHistory(raw.map(m => JSON.parse(m)).reverse());
    }

    // Fallback: load from MongoDB and repopulate Redis
    const session = await AIChatSession.findOne({ userId }).lean();
    if (session && session.messages.length > 0) {
      const messages = session.messages
        .slice(-MAX_MESSAGES)
        .map(m => ({ role: m.role, content: m.content }));

      const pipeline = redisClient.pipeline();
      // lpush newest-first so lrange(0..) returns newest-first
      for (const msg of messages) {
        pipeline.lpush(redisKey(userId), JSON.stringify(msg));
      }
      pipeline.expire(redisKey(userId), TTL);
      await pipeline.exec();

      return normalizeHistory(messages);
    }

    return [];
  } catch (error) {
    console.error('[ChatHistory] Get error:', error.message);
    return [];
  }
}

/**
 * Append a new message to both Redis and MongoDB.
 *
 * `entities` (only meaningful for assistant messages) is the structured list
 * of platform records referenced in the reply — persisted in Mongo so the
 * app's history reload can re-render the same suggestion cards, not just the
 * text. Deliberately NOT written to Redis: Redis history only feeds back into
 * the Claude API as conversation context, which never needs the entity JSON.
 */
async function appendMessage(userId, role, content, entities) {
  try {
    const message = JSON.stringify({ role, content });

    const pipeline = redisClient.pipeline();
    pipeline.lpush(redisKey(userId), message);
    pipeline.ltrim(redisKey(userId), 0, MAX_MESSAGES - 1);
    pipeline.expire(redisKey(userId), TTL);
    await pipeline.exec();

    const messageDoc = { role, content };
    if (entities && entities.length > 0) {
      messageDoc.entities = entities;
    }

    await AIChatSession.findOneAndUpdate(
      { userId },
      {
        $push: { messages: { $each: [messageDoc], $slice: -MAX_MESSAGES } },
        $set: { lastActive: new Date() },
        $inc: { totalQueries: role === 'user' ? 1 : 0 },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('[ChatHistory] Append error:', error.message);
  }
}

/**
 * Clear a user's chat history from Redis and optionally MongoDB.
 */
async function clearHistory(userId, clearDB = true) {
  console.log("clearDB",clearDB)
  await redisClient.del(redisKey(userId));
  if (clearDB) {
    await AIChatSession.findOneAndUpdate({ userId }, { $set: { messages: [] } });
  }
}

module.exports = { getChatHistory, appendMessage, clearHistory };
