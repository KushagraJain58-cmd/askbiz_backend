let mongoose = require('mongoose');

let verificationSkipSchema = new mongoose.Schema({
    tagName: {
        type: String,
        required: true,
        unique: true
    },
    tagUsedCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

let VerificationSkip = mongoose.model('VerificationSkip', verificationSkipSchema);
module.exports = VerificationSkip;
