const Redis = require('ioredis');
const {config} = require("../../utils/config")

const redisConfig = {
  port: config.redis_port,
  host: config.redis_host,
};

// const redisClient = new Redis(redisConfig, {
//   maxRetriesPerRequest: null
// });

const redisClient = new Redis(config.redis_url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: {}
});

redisClient.on('connect', () => {
  console.log(`Redis should install on system, Connected to Redis`);
});

redisClient.on('error', (err) => {
  console.error('Redis Error:', err);
});

redisClient.on('close', () => {
  console.log('Redis connection closed');
});

redisClient.on('reconnecting', () => {
  console.log('reconnecting to Redis...');
});

redisClient.on('ready', () => {
  console.log('Redis connection is ready for commands');
});

(async () => {
  try {
    await redisClient.ping();
    console.log('Redis ping successful');
  } catch (err) {
    console.error('Redis ping failed:', err);
  }
})();


module.exports = redisClient;
