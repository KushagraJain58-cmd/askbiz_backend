const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    chatRoomId : {
        type: mongoose.Schema.Types.ObjectId,
        required: true 
    },
    senderId: { 
      type: mongoose.Schema.Types.ObjectId,
      required: true 
    },
    messageType:{
        type : String,
        enums : ["text","image","video","doc","post","community","url","groupInfo"],
        default : "text"
    },
    textMessage: { 
      type: String
    },
    mediaUrl : {
      type: String
    },
    postId : {
      type: mongoose.Schema.Types.ObjectId
    },
    communityId : {
      type: mongoose.Schema.Types.ObjectId
    },
    status : {
      type : String ,
      enums : ["active","deleted"],
      default : "active"
    },
    deletedBy : [mongoose.Schema.Types.ObjectId],
    seenBy: [{ type: mongoose.Schema.Types.ObjectId }]
},{
    timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);
