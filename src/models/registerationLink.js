const mongoose = require('mongoose');

const registrationLinkSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400 // 24 hours in seconds (optional)
    }
});

const RegistrationLink = mongoose.model('RegistrationLink', registrationLinkSchema);

module.exports = RegistrationLink

