const { Queue } = require("bullmq");
const {config} = require("../config/index")

const adminAlertNotificationQueue = new Queue("adminAlertNotificationQueue", {
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

adminAlertNotificationQueue.on("error", (err) => {
    console.error("Notification Queue Error:", err);
});

async function addToAdminAlertNotificationQueue(title, message, tokens, data) {
    try {
        if (!tokens || tokens.length === 0) {
            console.warn("No valid tokens to add to queue.");
            return;
        }

        const jobData = { title, message, tokens, data };
        await adminAlertNotificationQueue.add("sendAdminAlertNotificationBatch", jobData);
        console.log("Notification added to queue successfully.");
    } catch (error) {
        console.error("Error adding notification to queue:", error);
    }
}

module.exports = {
    adminAlertNotificationQueue,
    addToAdminAlertNotificationQueue
};
