const redisClient = require("../../src/config/redis")

const recordLogin = async (userId) => {
    try {
        if (!redisClient.isReady) {
            console.error("Redis client is not connected.");
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const key = `daily_logins:${today}`;
        
        const count = await redisClient.incr(key);
        console.log(`Login count for ${today}: ${count}`);
    } catch (err) {
        console.error("Redis Error:", err);
    }
};

module.exports = { recordLogin };
