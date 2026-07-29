let mongoose = require("mongoose");
let Schema = mongoose.Schema;

// Structured platform records (business/expert/community/post) referenced in
// an assistant reply, persisted alongside the text so the app can re-render
// tappable suggestion cards after a history reload — not just on first view.
let entitySchema = new Schema({
    kind: {
        type: String,
        enum: ["business", "expert", "community", "post"],
        required: true
    },
    id: { type: String, required: true },
    name: { type: String, required: true },
    subtitle: String,
    city: String,
    image: String,
    verified: Boolean,
    communityType: { type: String, enum: ["public", "private"] },
    description: String,
}, { _id: false });

let messageSchema = new Schema({
    role: {
        type: String,
        enum: ["user", "assistant"],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    entities: {
        type: [entitySchema],
        default: undefined
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

let aiChatSessionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        index: true
    },
    messages: [messageSchema],
    lastActive: {
        type: Date,
        default: Date.now
    },
    totalQueries: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

aiChatSessionSchema.index({ userId: 1, lastActive: -1 });

module.exports = mongoose.model('aiChatSession', aiChatSessionSchema);
