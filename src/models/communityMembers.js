let mongoose = require("mongoose");
let Community = require("./community");
let User = require("./users")
let Schema = mongoose.Schema;

let communityMemberSchema = new Schema({
    communityId : {
        type: Schema.Types.ObjectId,
        ref: Community, 
        required: true,
    },
    memberId: {
        type: Schema.Types.ObjectId,
        ref: User, 
        required: true
    },
    communityRole: {
        type: String,
        enum: ['admin', 'member', 'moderator'],
        required: true
    },
    status: {
        type: String,
        enum: ["active", "block"],
        default: 'active'
    },
    updatedBy:{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true 
});

communityMemberSchema.index({ memberId: 1, communityId: 1 });

let CommunityMember = mongoose.model('CommunityMember', communityMemberSchema);

module.exports = CommunityMember;
