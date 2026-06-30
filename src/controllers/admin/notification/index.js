const notificationController = require("./notificationModule");

module.exports = {
    addNotificationAlert: notificationController.addNotificationAlert,
    updateNotificationAlert : notificationController.updateNotificationAlert,
    deleteNotificationAlert : notificationController.deleteNotificationAlert,
    getNotificationAlerts : notificationController.getNotificationAlerts,
    resendNotificationAlert : notificationController.resendNotificationAlert,
    getReceivedUsers : notificationController.getReceivedUsers
};
