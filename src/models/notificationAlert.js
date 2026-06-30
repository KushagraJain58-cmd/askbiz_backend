const mongoose = require("mongoose");

const notificationAlertSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    userType: {
        type: String,
        enum: ["Selected", "Individual", "Bussiness", "Expert", "All"],
        required: true
    },
    toUsers : [ mongoose.Types.ObjectId ],
    selectedUsers : [ mongoose.Types.ObjectId ],
    numberOfUsers: {
        type: Number,
        default: 0
    },
    sentOn: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
    },
}, {
    timestamps: true
});

module.exports = mongoose.model("NotificationAlert", notificationAlertSchema);
