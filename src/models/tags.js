let mongoose = require('mongoose');

let tagSchema = new mongoose.Schema({
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

let Tag = mongoose.model('Tag', tagSchema);
module.exports = Tag;
