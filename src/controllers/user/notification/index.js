const notificationController = require('./notification');

module.exports = {
    getNotifications: notificationController.getNotifications,
    deleteNotification: notificationController.deleteNotification,
    hasUnseenNotifications: notificationController.hasUnseenNotifications,
    toggleNotification : notificationController.toggleNotification
};
