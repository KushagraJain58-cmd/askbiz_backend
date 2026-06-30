const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  person: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  isAdmin : {
    type : Boolean,
    default : false
  },
  status : {
    type : String,
    enum : ['active', 'inactive','cleared','deleted','removed'],
    default : 'inactive'
  },
  muteNotifications : {
    type: Boolean,
    default: false
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  clearedAt: {
    type: Date,
    default: null 
  },
  removedAt: {
    type: Date,
    default: null
  }
});

const chatRoomSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['group', 'oneToOne'],
    required: true
  },
  groupImage : {
    type: String
  },
  groupName: {
    type: String 
  },
  groupDescription: {
    type: String 
  },
  creator: { 
    type: mongoose.Schema.Types.ObjectId
  },
  participants: [participantSchema],
  participantsKey: {   // only for oneToOne chat.
    type: String, 
    unique: true, 
    sparse: true 
  },
  isAdminChat: {
    type: Boolean,
    default: false
  }
},{
  timestamps: true
});

chatRoomSchema.pre('save', function(next) {
  if (this.type === 'oneToOne') {
    if (this.participants.length !== 2) {
      return next(new Error('OneToOne chat must have exactly two participants'));
    }
    
    const personIds = this.participants.map(p => p.person.toString()).sort();
    this.participantsKey = personIds.join('-');
  }
  next();
});

chatRoomSchema.index({ participantsKey: 1 }, { 
  unique: true, 
  partialFilterExpression: { type: 'oneToOne' } 
});


module.exports = mongoose.model('ChatRoom', chatRoomSchema);