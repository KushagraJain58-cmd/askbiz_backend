let mongoose = require('mongoose');

let reviewSchema = new mongoose.Schema({
    reviewTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewContent:{
        type: String
    },
    likeCount : {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

let Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
