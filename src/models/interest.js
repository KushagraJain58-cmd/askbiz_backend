let mongoose = require('mongoose');

let interestSchema = new mongoose.Schema({
    interestName: {
        type: String,
        required: true,
        unique: true
    },
    interestUsedCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

let Interest = mongoose.model('Interest', interestSchema);
module.exports = Interest;
