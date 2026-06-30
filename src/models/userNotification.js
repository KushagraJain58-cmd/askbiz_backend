const mongoose = require("mongoose");
let Schema = mongoose.Schema;

const userNotificationSchema = new mongoose.Schema({
    recipientId: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId
    },
    type: { 
        type: String,
        enum: ['like', 'comment','reply','review', 'follow', 'mention','community', 'message', 'report', 'admin_alert'],  
    },
    referenceId: { 
        type: mongoose.Schema.Types.ObjectId, 
    },
    referenceType: { 
        type: String, 
        enum: ['Post', 'Comment', 'Community', 'User', 'Report', "NotificationAlert"] 
    },
    message: { 
        type: String 
    },
    isRead: { 
        type: Boolean, 
        default: false 
    }
},{
    timestamps: true
});

const UserNotification = mongoose.model('UserNotification', userNotificationSchema);
module.exports = UserNotification;


