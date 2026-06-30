const mongoose = require('mongoose');

const chatRequestSchema = new mongoose.Schema({
  senderId: {     
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  receiverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }, 
  chatRoomId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ChatRoom' 
  }, 
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected'], 
    default: 'pending' 
  },
  requestType: { 
    type: String, 
    enum: ['oneToOne', 'group'], 
    required: true 
  }
},{
  timestamps: true
});

module.exports = mongoose.model('ChatRequest', chatRequestSchema);
