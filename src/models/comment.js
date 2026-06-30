let mongoose = require("mongoose");
let User = require("./users")
let Schema = mongoose.Schema;

let commentSchema = new Schema({
    postId: {
        type: Schema.Types.ObjectId,
        ref: 'Post',
        required: true
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

let Comment = mongoose.model('Comment', commentSchema);
module.exports = Comment;
