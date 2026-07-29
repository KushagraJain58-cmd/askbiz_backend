const redisClient = require('../config/redis');
const { config } = require('../../utils/config');

const MAX_REQUESTS = config.ai_rate_limit_max;
const WINDOW_SECONDS = config.ai_rate_limit_window_seconds;

/**
 * Fixed-window rate limiter for AI queries, backed by Redis (ioredis).
 * Not an Express middleware — called directly from the socket handler
 * before each AI query.
 */
async function aiRateLimit(userId) {
  const key = `ai:ratelimit:${userId}`;

  const count = await redisClient.incr(key);
  if (count === 1) {
    await redisClient.expire(key, WINDOW_SECONDS);
  }

  let ttl = await redisClient.ttl(key);
  if (ttl === -1) {
    // Expiry was lost (e.g. crash between INCR and EXPIRE) — reset it
    await redisClient.expire(key, WINDOW_SECONDS);
    ttl = WINDOW_SECONDS;
  }

  if (count > MAX_REQUESTS) {
    const minutesLeft = Math.ceil(ttl / 60);
    return {
      allowed: false,
      message: `You have used your ${MAX_REQUESTS} AI queries for this hour. Please try again in ${minutesLeft} minute(s).`,
      retryAfter: ttl,
    };
  }

  return {
    allowed: true,
    remaining: MAX_REQUESTS - count,
    resetIn: ttl,
  };
}

module.exports = { aiRateLimit };
