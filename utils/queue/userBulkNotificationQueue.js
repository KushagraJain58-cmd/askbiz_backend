const { Queue } = require("bullmq");
const redisClient = require("../../src/config/redis");
const {config} = require("../config/index")

const userBulkNotificationQueue = new Queue("userBulkNotificationQueue", {
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

userBulkNotificationQueue.on("error", (err) => {
    console.error("User Bulk Notification Queue Error:", err);
});

async function addToUserBulkNotificationQueue(senderId, recipientIds, title, message, payload, communityId = null, chatRoomId = null) {
    try {
        if (!recipientIds || recipientIds.length === 0) {
            console.warn("No valid recipient IDs to add to queue.");
            return;
        }

        const jobData = { senderId, recipientIds, title, message, payload, communityId, chatRoomId };

        await userBulkNotificationQueue.add("sendUserBulkNotificationBatch", jobData);
        console.log("User Bulk Notification added to queue successfully.");
    } catch (error) {
        console.error("Error adding user bulk notification to queue:", error);
    }
}

module.exports = {
    userBulkNotificationQueue,
    addToUserBulkNotificationQueue
};
