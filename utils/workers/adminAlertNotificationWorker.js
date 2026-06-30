const { Worker } = require("bullmq");
const { sendMulticastNotification } = require("../../src/config/notification");
const redisClient = require("../../src/config/redis");
const { config } = require("../config/index");

const adminAlertNotificationWorker = new Worker("adminAlertNotificationQueue", async (job) => {
    const { title, message, tokens, data } = job.data;
    
    console.log(`Processing admin alert notification: ${title}`);

    await sendMulticastNotification(tokens, title, message, data);

}, {
    // connection: {
    //     host: config.redis_host,
    //     port: config.redis_port,
    // }
    connection: {
      url: config.redis_url,
      tls: {},                  // REQUIRED for rediss://
      maxRetriesPerRequest: null
    }
});

adminAlertNotificationWorker.on("error", (err) => {
    console.error("Admin Alert Notification Worker Error:", err);
});

module.exports = adminAlertNotificationWorker;
