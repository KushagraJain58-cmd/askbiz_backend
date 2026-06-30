let mongoose = require("mongoose");
let Schema = mongoose.Schema;

let communitySchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    },
    communityName: {
        type: String,
        required: true 
    },
    communityUsername: {
        type: String,
        required: true,
        unique: true
    },
    communityType: {
        type: String,
        enum: ['public', 'private'],
        required: true
    },
    location: {   
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: { // latitude , longitude
            type: [Number],
            default: [0, 0]
        },
        cityName: {
            type: String,
            required: false
        }
    },
    interest: [{
        interestType: String,
        value: [String]
    }],
    logo: {
        type: String,
        default : "https://thumbs.dreamstime.com/b/community-concept-pictogram-showing-figures-happy-family-84451213.jpg"
    },
    coverImage: String,
    description: String,
    status : {
        type: String,
        enum: ['active', 'blocked', 'inactive'],
        default: 'active'
    },
    savedPosts : [
        {
            type: Schema.Types.ObjectId,
            ref: 'Post'
        }
    ],
    pinedPosts : [
        {
            type: Schema.Types.ObjectId,
            ref: 'Post'
        }
    ],
    mutedMembers: [
        {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    deletionHistory: [
        {
            deletedBy: {
                type: Schema.Types.ObjectId,
                ref: 'User'
            },
            deletedAt: {
                type: Date
            }
        }
    ],
    communityLink : {
        type: String,
        default : ""
    }
}, {
    timestamps: true 
});

let Community = mongoose.model('Community', communitySchema);

module.exports = Community;
