let mongoose = require("mongoose");
let Schema = mongoose.Schema;
let User = require('../models/users')

let accountRequestSchema = new Schema({
    sendBy: {
        type: Schema.Types.ObjectId,
        ref: User,
        required: true
    },
    currentAccountType: {
        type: String,
        enum: ['Individual', 'Expert', 'Bussiness'],
        required: true
    },
    requestedAccountType: {
        type: String,
        enum: ['Individual', 'Expert', 'Bussiness'],
        required: true
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin'
    },
    requestDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true
});

let AccountRequest = mongoose.model('accountRequest', accountRequestSchema);

module.exports = AccountRequest;
