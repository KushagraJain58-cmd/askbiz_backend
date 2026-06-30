const mongoose = require('mongoose');
const { Schema } = mongoose;

const interactionSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        postId: {
            type: Schema.Types.ObjectId,
            ref: "Post",
            required: true
        },
        type: {
            type: String,
            enum: ["like", "comment", "share", "bookmark"],
            required: true
        },
        content: {
            type: String
        },
        fileURL: {
            type: String
        },
        mentionPerson: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },
    },
    { timestamps: true }
);

interactionSchema.index({ userId: 1, createdAt: -1 });

const Interaction = mongoose.model("Interaction", interactionSchema);
module.exports = Interaction;