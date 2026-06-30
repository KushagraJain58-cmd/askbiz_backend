let mongoose = require("mongoose");
let Schema = mongoose.Schema;
let User = require('../models/users')

let communityRequestSchema = new Schema({
    sendBy: {
        id: { type: Schema.Types.ObjectId, required: true }, // ID of the sender
        type: { type: String, enum: ['user', 'community'], required: true } // Sender type
    },
    sendTo: {
        id: { type: Schema.Types.ObjectId, required: true }, // ID of the receiver
        type: { type: String, enum: ['user', 'community'], required: true } // Receiver type
    },
    communityRequesterId : {     // store requestor Id who send request to join community.
        type: Schema.Types.ObjectId,
        required: false
    },
    requestDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true
});

let CommunityRequest = mongoose.model('communityRequest', communityRequestSchema);

module.exports = CommunityRequest;
