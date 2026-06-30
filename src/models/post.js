let mongoose = require("mongoose");
let Schema = mongoose.Schema;

let postSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    },
    title: {
        type: String,
        required: true 
    },
    interest: [{
        interestType: String,
        value: [String]
    }],
    description: {
        type: String 
    },
    postType: {
        type: String,
        enum: ['normal', 'community'],
        required: true
    },
    imagesOrVideos: [{
        name : String,
        fileType : {
            type: String,
            enum: ['image', 'video'],
        },
        uri : String,
        thumbnailUrl : String,
        height : Number,
        width : Number,
        duration : String
    }],
    audienceSelection: {
        type: String,
        enum: ['public', 'private'],
        required: false
    },
    communityId: {
        type: Schema.Types.ObjectId,
        ref: 'Community',
        required: false
    },
    mentionPeople: {
        type: [Schema.Types.ObjectId],
        ref: 'User',
        required: false
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default : 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        },
        cityName: {
            type: String,
            required: false
        }
    },
    tags : [String],
    hideLikeAndViewCounts: {
        type: Boolean,
        default: false
    },
    turnOffCommenting: {
        type: Boolean,
        default: false
    },
    makePostAsQuery: {
        type: Boolean,
        default: false
    },
    likeCount : {
        type: Number,
        default: 0
    },
    shareCount : {
        type: Number,
        default: 0
    },
    viewerId :[Schema.Types.ObjectId],
    viewCount : {
        type: Number,
        default: 0
    },
    maxMediaRatio : String,
    postLink : {
        type: String,
        default : ""
    }
}, {
    timestamps: true 
});

postSchema.index({
    location: "2dsphere"
});

let Post = mongoose.model('Post', postSchema);

module.exports = Post;
