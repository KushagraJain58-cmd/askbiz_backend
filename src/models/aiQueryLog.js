let mongoose = require("mongoose");
let Schema = mongoose.Schema;

let aiQueryLogSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    // Matches the accountType discriminator values on the users model
    userRole: {
        type: String,
        enum: ["Individual", "Bussiness", "Expert"]
    },
    query: {
        type: String,
        required: true
    },
    responseLength: Number,
    dbResultsCount: Number,
    ragResultsCount: Number,
    usedWebSearch: {
        type: Boolean,
        default: false
    },
    durationMs: Number,
    feedback: {
        type: String,
        enum: ['positive', 'negative', null],
        default: null
    },
    errorOccurred: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

aiQueryLogSchema.index({ userId: 1, createdAt: -1 });
aiQueryLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('aiQueryLog', aiQueryLogSchema);
