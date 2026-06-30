let mongoose = require("mongoose");
let Schema = mongoose.Schema;

let likeSchema = new Schema({
    itemId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    itemType: {
        type: String,
        enum: ['Post', 'Comment', 'Reply', 'Review'],
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isLiked: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true 
});

let Like = mongoose.model('Like', likeSchema);
module.exports = Like;
