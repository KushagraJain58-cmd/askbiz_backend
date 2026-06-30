const { Worker } = require("bullmq");
const { sendUserBulkNotifications } = require("../../utils/helpers/notificationUtils")
const redisClient = require("../../src/config/redis");
const { config } = require("../config/index");


const userBulkNotificationWorker = new Worker(
    "userBulkNotificationQueue",
    async (job) => {
        const { senderId, recipientIds, title, message, payload, communityId, chatRoomId } = job.data;

        console.log(`Processing User Bulk notification: ${title}`);

        await sendUserBulkNotifications(senderId,recipientIds,title,message,payload,communityId,chatRoomId)
    },
    {
        // connection: {
        //     host: config.redis_host,
        //     port: config.redis_port,
        // }
        connection: {
        url: config.redis_url,
        tls: {},                  // REQUIRED for rediss://
        maxRetriesPerRequest: null
        }
    }
);

userBulkNotificationWorker.on("error", (err) => {
    console.error("User Bulk Notification Worker Error:", err);
});

module.exports = userBulkNotificationWorker;
