let mongoose = require("mongoose");
let Schema = mongoose.Schema;

let replySchema = new Schema({
    commentId: {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
    },
    reviewId:{
        type: Schema.Types.ObjectId,
        ref: 'Review',
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fileURL: {
        type: String
    },
    mentionPeople: {
        type: [Schema.Types.ObjectId],
        ref: 'User',
        required: false
    },
    content: {
        type: String,
        required: true
    },
    likeCount : {
        type: Number,
        default: 0
    }
}, {
    timestamps: true 
});

let Reply = mongoose.model('Reply', replySchema);
module.exports = Reply;
