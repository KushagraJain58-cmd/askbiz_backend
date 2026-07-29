/**
 * Manages AI chat sessions (Claude-style: many conversations per user).
 *
 * - MongoDB (aiChatSession) is the source of truth — one document per session.
 * - Redis caches each session's recent messages for fast prompt assembly,
 *   keyed per session so a query only ever sees its own conversation.
 * - A user keeps at most MAX_SESSIONS sessions; creating one beyond the cap
 *   evicts the least-recently-active session everywhere (Mongo + Redis).
 */

const redisClient = require('../../config/redis');
const AIChatSession = require('../../models/aiChatSession');
const { config } = require('../../../utils/config');

const MAX_TURNS = config.ai_chat_history_max_turns; // user+assistant pairs
const MAX_MESSAGES = MAX_TURNS * 2;
const TTL = config.ai_chat_history_ttl;
const MAX_SESSIONS = config.ai_max_sessions;

function redisKey(userId, sessionId) {
  return `ai:chat:${userId}:${sessionId}`;
}

/**
 * The Anthropic API requires the first message to be from the user. After
 * trimming, the window can start with an assistant message — drop leaders.
 */
function normalizeHistory(messages) {
  const firstUser = messages.findIndex(m => m.role === 'user');
  return firstUser === -1 ? [] : messages.slice(firstUser);
}

/** Build a short sidebar title from the first user message. */
function deriveTitle(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'New chat';
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
}

/**
 * Every read/write is scoped by BOTH _id and userId so one user can never
 * reach another user's session by guessing an ObjectId.
 */
async function findOwnedSession(userId, sessionId, projection) {
  if (!sessionId) return null;
  try {
    return await AIChatSession.findOne({ _id: sessionId, userId }, projection).lean();
  } catch (error) {
    // Malformed ObjectId — treat as not found rather than throwing
    return null;
  }
}

/** Sessions for the sidebar, most recently active first. */
async function listSessions(userId) {
  const sessions = await AIChatSession.find({ userId })
    .select('title lastActive totalQueries createdAt')
    .sort({ lastActive: -1 })
    .limit(MAX_SESSIONS)
    .lean();

  return sessions.map(s => ({
    id: s._id.toString(),
    title: s.title || 'New chat',
    lastActive: s.lastActive,
    totalQueries: s.totalQueries || 0,
    createdAt: s.createdAt,
  }));
}

/**
 * Create a session, evicting the oldest ones if the user is at the cap.
 * Eviction removes the Redis cache too, so nothing is left behind.
 */
async function createSession(userId, title = 'New chat') {
  const existing = await AIChatSession.find({ userId })
    .select('_id')
    .sort({ lastActive: -1 })
    .lean();

  // Keep at most MAX_SESSIONS - 1 so the new one fits inside the cap
  if (existing.length >= MAX_SESSIONS) {
    const stale = existing.slice(MAX_SESSIONS - 1);
    await Promise.all(stale.map(s => deleteSession(userId, s._id.toString())));
  }

  const session = await AIChatSession.create({
    userId,
    title,
    messages: [],
    lastActive: new Date(),
  });

  return {
    id: session._id.toString(),
    title: session.title,
    lastActive: session.lastActive,
    totalQueries: 0,
  };
}

/**
 * Permanently remove a session: Mongo document + Redis cache.
 * Returns false if the session doesn't exist or isn't owned by this user.
 */
async function deleteSession(userId, sessionId) {
  let deleted;
  try {
    deleted = await AIChatSession.findOneAndDelete({ _id: sessionId, userId });
  } catch (error) {
    return false; // malformed id
  }
  if (!deleted) return false;

  await redisClient.del(redisKey(userId, sessionId));
  return true;
}

/**
 * Manually rename a session (overrides the auto-derived title going forward —
 * appendMessage only auto-titles a session while its title is still "New chat").
 * Returns the updated { id, title }, or null if not found/owned.
 */
async function renameSession(userId, sessionId, title) {
  const clean = String(title || '').trim().slice(0, 80);
  if (!clean) return null;

  let updated;
  try {
    updated = await AIChatSession.findOneAndUpdate(
      { _id: sessionId, userId },
      { $set: { title: clean } },
      { new: true, select: 'title' }
    );
  } catch (error) {
    return null; // malformed id
  }
  if (!updated) return null;

  return { id: updated._id.toString(), title: updated.title };
}

/**
 * Resolve the session to use for a query. Falls back to creating one when the
 * client sends no (or an unknown/foreign) sessionId, so a query never fails
 * just because session state drifted between app and server.
 */
async function resolveSession(userId, sessionId) {
  const owned = await findOwnedSession(userId, sessionId, '_id');
  if (owned) return owned._id.toString();

  const created = await createSession(userId);
  return created.id;
}

/**
 * Get the recent messages of ONE session (oldest first).
 * Falls back to MongoDB if the Redis cache is cold.
 */
async function getChatHistory(userId, sessionId) {
  if (!sessionId) return [];
  try {
    const key = redisKey(userId, sessionId);
    const raw = await redisClient.lrange(key, 0, MAX_MESSAGES - 1);
    if (raw && raw.length > 0) {
      // lpush stores newest first — reverse to chronological order
      return normalizeHistory(raw.map(m => JSON.parse(m)).reverse());
    }

    // Cold cache: rebuild from MongoDB
    const session = await findOwnedSession(userId, sessionId, 'messages');
    if (session && session.messages.length > 0) {
      const messages = session.messages
        .slice(-MAX_MESSAGES)
        .map(m => ({ role: m.role, content: m.content }));

      const pipeline = redisClient.pipeline();
      for (const msg of messages) {
        pipeline.lpush(key, JSON.stringify(msg));
      }
      pipeline.expire(key, TTL);
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
 * Append a message to one session, in Redis and MongoDB.
 *
 * `entities` (assistant messages only) is the structured list of platform
 * records referenced in the reply — persisted in Mongo so a history reload
 * re-renders the same suggestion cards. Not cached in Redis: that copy only
 * feeds the Claude API, which never needs the entity JSON.
 */
async function appendMessage(userId, sessionId, role, content, entities) {
  if (!sessionId) return;
  try {
    const key = redisKey(userId, sessionId);
    const pipeline = redisClient.pipeline();
    pipeline.lpush(key, JSON.stringify({ role, content }));
    pipeline.ltrim(key, 0, MAX_MESSAGES - 1);
    pipeline.expire(key, TTL);
    await pipeline.exec();

    const messageDoc = { role, content };
    if (entities && entities.length > 0) {
      messageDoc.entities = entities;
    }

    const update = {
      $push: { messages: { $each: [messageDoc], $slice: -MAX_MESSAGES } },
      $set: { lastActive: new Date() },
      $inc: { totalQueries: role === 'user' ? 1 : 0 },
    };

    // Name the session after its first user message — but never clobber a
    // title the user set manually via rename, even if it happens before the
    // first message is sent.
    if (role === 'user') {
      const session = await findOwnedSession(userId, sessionId, 'title');
      if (!session || !session.title || session.title === 'New chat') {
        update.$set.title = deriveTitle(content);
      }
    }

    await AIChatSession.findOneAndUpdate({ _id: sessionId, userId }, update);
  } catch (error) {
    console.error('[ChatHistory] Append error:', error.message);
  }
}

/**
 * Clear the messages of one session without deleting the session itself.
 */
async function clearHistory(userId, sessionId, clearDB = false) {
  if (!sessionId) return;
  await redisClient.del(redisKey(userId, sessionId));
  if (clearDB) {
    await AIChatSession.findOneAndUpdate(
      { _id: sessionId, userId },
      { $set: { messages: [], title: 'New chat' } }
    );
  }
}

module.exports = {
  getChatHistory,
  appendMessage,
  clearHistory,
  listSessions,
  createSession,
  deleteSession,
  renameSession,
  resolveSession,
  findOwnedSession,
  MAX_SESSIONS,
};
