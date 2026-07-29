let mongoose = require("mongoose");
let Schema = mongoose.Schema;

let knowledgeChunkSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['registration', 'gst', 'msme', 'funding', 'licensing', 'taxation',
               'export', 'banking', 'labour', 'ecommerce', 'general'],
        required: true
    },
    tags: [String],
    source: {
        type: String,
        default: 'internal'
    },
    pineconeId: {
        type: String,
        unique: true,
        sparse: true
    },
    isEmbedded: {
        type: Boolean,
        default: false
    },
    language: {
        type: String,
        enum: ['en', 'hi'],
        default: 'en'
    }
}, {
    timestamps: true
});

knowledgeChunkSchema.index({ category: 1, isEmbedded: 1 });
knowledgeChunkSchema.index({ tags: 1 });

module.exports = mongoose.model('knowledgeChunk', knowledgeChunkSchema);
