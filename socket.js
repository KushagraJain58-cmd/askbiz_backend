const ChatRoom = require('./src/models/chat');
const Message = require('./src/models/message');
const mongoose = require('mongoose');
const User = require('./src/models/users');
const Admin = require("./src/models/admin");
const redisClient = require("./src/config/redis");
const UserNotification = require("./src/models/userNotification")
const { sendOneToOneNotification, sendUserBulkNotifications } = require("./utils/helpers/notificationUtils")


const getUnseenChatroomCount = async (userId) => {

  const userChatRooms = await ChatRoom.find({
      "participants.person": userId,
      "participants.status": "active",
    }).select('_id').lean();
  
    if (!userChatRooms.length) return 0;
  
    const chatRoomIds = userChatRooms.map(room => room._id);
  
    const unseenMessages = await Message.aggregate([
      {
        $match: {
          chatRoomId: { $in: chatRoomIds },
          seenBy: { $ne: new mongoose.Types.ObjectId(userId) },
          deletedBy: { $ne: new mongoose.Types.ObjectId(userId) }
        }
      },
      {
        $group: { _id: "$chatRoomId" }
      }
    ]);

  return unseenMessages.length > 0 ? unseenMessages.length : 0;
};


const getPopulatedMessage = async (messageId) => {
  try {
    const result = await Message.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(messageId) } },
      {
        $lookup: {
          from: 'posts',
          localField: 'postId',
          foreignField: '_id',
          as: 'postDetails',
          pipeline : [
            {
                $project: {
                    _id : 1,
                    title: 1,
                    userId : 1,
                    description : 1,
                    postType : 1,
                    imagesOrVideos : { $arrayElemAt: ["$imagesOrVideos", 0] },
                    audienceSelection : 1,
                    communityId : 1,
                    createdAt : 1
                }
            }
          ]
        }
      },
      { $unwind: { path: '$postDetails', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'postDetails.userId',
          foreignField: '_id',
          as: 'postCreator',
          pipeline: [
            {
                $project: {
                    _id: 1,
                    name: 1,
                    businessName: 1,
                    username: 1,
                    profileImage: 1,
                    accountType: 1,
                    description: 1,
                    shortBio: 1,
                    blueTick: 1
                }
            }
          ]
        }
      },
      { $unwind: { path: '$postCreator', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'communities',
          localField: 'postDetails.communityId',
          foreignField: '_id',
          as: 'postCommunityDetail',
          pipeline: [
            {
                $project: {
                    _id: 1,
                    userId : 1,
                    communityName: 1,
                    communityUsername: 1,
                    communityType: 1,
                    logo: 1,
                    coverImage: 1,
                    description: 1
                }
            }
          ]
        }
      },
      { $unwind: { path: '$postCommunityDetail', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'communities',
          localField: 'communityId',
          foreignField: '_id',
          as: 'communityDetail',
          pipeline: [
            {
                $project: {
                    _id: 1,
                    userId : 1,
                    communityName: 1,
                    communityUsername: 1,
                    communityType: 1,
                    logo: 1,
                    coverImage: 1,
                    description: 1
                }
            }
          ]
        }
      },
      { $unwind: { path: '$communityDetail', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          chatRoomId: 1,
          senderId: 1,
          messageType: 1,
          textMessage: 1,
          mediaUrl: 1,
          clientId : "$clientId",
          status: 1,
          createdAt: 1,
          postCommunityDetail : 1,
          postCreator : 1,
          postDetails : 1,
          communityDetail: 1
        }
      }
    ]);

    return result[0] || null;
  } catch (err) {
    console.error('Error in getPopulatedMessage:', err);
    return null;
  }
};



const socketUtiles = (io, socket) => {
  console.log('Socket connected:', socket.id);


  const { userId, name, userType, profileImage, accountType } = socket.data

  if (userId) {
    io.emit('online-user', { userId, online: true });

    redisClient.hSet("onlineUsers", userId, socket.id);
  }

  socket.on('joinRoom', async ({ roomId }) => {
    if (!roomId) {
      socket.emit('joinRoom-error', { message: 'roomId is required to join the room.' });
      return;
    }

    try {
      const query = { $or: [] };

      if (mongoose.Types.ObjectId.isValid(roomId)) {
        query.$or.push({ _id: new mongoose.Types.ObjectId(roomId) });
      }
      query.$or.push({ participantsKey: roomId });

      const chatRoom = await ChatRoom.findOne(query);

      if (!chatRoom) {
        socket.emit('joinRoom-error', { message: 'Group not found.' });
        return;
      }

      if (!chatRoom.participants.some(p => p.person.toString() === userId.toString())) {
        socket.emit('joinRoom-error', { message: 'User is not a participant of this group.' });
        return;
      }

      socket.join(roomId);

      await Message.updateMany(
        { chatRoomId: chatRoom._id, seenBy: { $ne: userId } },
        { $push: { seenBy: new mongoose.Types.ObjectId(userId) } }
      );

      io.to(roomId).emit('messages-seen', { roomId, seenBy: userId });

      socket.emit('joinRoom-success', { message: 'Joined room successfully.', roomId });

      console.log(`User ${userId} joined room: ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('joinRoom-error', { message: error.message });
    }
  });

  socket.on('send-msg', async ({ roomId, clientId, messageType, textMessage, mediaUrl, postId, communityId }) => {

    console.log("socketttttt----",socket.data)

    if (!roomId || !messageType) {
      socket.emit('sendMess-error', { message: 'roomId and messageType are required.' });
      return;
    }
    if (!textMessage && !postId && !mediaUrl && !communityId) {
      socket.emit('sendMess-error', { message: 'Either message, postId , mediaUrl and communityId is required.' });
      return;
    }

    try {
      const query = { $or: [] };

      if (mongoose.Types.ObjectId.isValid(roomId)) {
        query.$or.push({ _id: new mongoose.Types.ObjectId(roomId) });
      }
      query.$or.push({ participantsKey: roomId });

      const chatRoom = await ChatRoom.findOne(query);

      if (!chatRoom) {
        socket.emit('sendMess-error', { message: 'Chat room not found.' });
        return;
      }

      // const otherParticipants = chatRoom.participants
      //   .filter(p => p.person.toString() !== userId.toString())
      //   .map(p => new mongoose.Types.ObjectId(p.person));

      const otherParticipants = chatRoom.participants
      .filter(p => 
        p.person.toString() !== userId.toString() &&
        ["active", "cleared", "deleted"].includes(p.status)
      ).map(p => new mongoose.Types.ObjectId(p.person));
    

      const newMessageObject = {
        chatRoomId: chatRoom._id,
        senderId: userId,
        messageType,
        textMessage,
        mediaUrl,
        postId,
        communityId,
        seenBy: [new mongoose.Types.ObjectId(userId)]
      };

      const newMessage = await Message.create(newMessageObject);

      if (!newMessage) {
        socket.emit('sendMess-error', { message: 'Error saving message.' });
        return;
      }

      const populatedMessage = await getPopulatedMessage(newMessage._id);

      io.to(roomId).emit('rev-msg', {
        ...populatedMessage,
        clientId
      });

      io.to(roomId).emit('update-chatInbox-order', {
        roomId,
        lastMessage: newMessage,
        updatedAt: new Date(),
      });

      let updateRequired = false;
      chatRoom.participants.forEach(participant => {
        if (["deleted", "cleared"].includes(participant.status)) {
          updateRequired = true;
        }
      });

      if (updateRequired) {
        await ChatRoom.updateOne(
          { _id: chatRoom._id },
          { $set: { "participants.$[].status": "active" } }
        );
        chatRoom.participants.forEach(participant => participant.status = 'active');
      }

      for (const participantId of otherParticipants) {
        const participantSocketId = await redisClient.hGet("onlineUsers", participantId.toString());
        if (participantSocketId) {
          io.to(participantSocketId).emit('unseen-messages', {
            roomId,
            messageId: newMessage._id
          });

          const getCount = await getUnseenChatroomCount(participantId.toString())

          io.to(participantSocketId).emit('update-unseen-chatrooms', {
            totalChatRoomsWithUnseen : getCount
          });

        }
      }

      await sendUserBulkNotifications(
        userId,
        otherParticipants,
        "New Message",
        `${name || "Unknown User"} sent a new message!`,
        {
          type: "message",
          roomId: roomId,
          chatId : chatRoom._id.toString(),
          chatType : chatRoom.type,
          profileImage : profileImage,
          name : name,
          accountType : accountType,
        }
      );

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('sendMess-error', { message: error.message });
    }
  })

  socket.on('mark-seen', async ({ roomId }) => {
    if (!roomId) {
      socket.emit('mark-seen-error', { message: 'roomId is required.' });
      return;
    }

    try {
      const query = { $or: [] };

      if (mongoose.Types.ObjectId.isValid(roomId)) {
        query.$or.push({ _id: new mongoose.Types.ObjectId(roomId) });
      }
      query.$or.push({ participantsKey: roomId });

      const chatRoom = await ChatRoom.findOne(query);

      if (!chatRoom) {
        socket.emit('mark-seen-error', { message: 'Chat room not found.' });
        return;
      }

      await Message.updateMany(
        { chatRoomId: chatRoom._id, seenBy: { $ne: userId } },
        { $push: { seenBy: new mongoose.Types.ObjectId(userId) } }
      );

      io.to(roomId).emit('messages-seen', { roomId, seenBy: userId });

    } catch (error) {
      console.error('Error marking messages as seen:', error);
      socket.emit('mark-seen-error', { message: error.message });
    }
  });

  socket.on('mark-notification-read', async () => {

    try {

      await UserNotification.updateMany(
        { recipientId: userId, isRead: false },
        { $set: { isRead: true } }
      );

      const userSocketId = await redisClient.hGet("onlineUsers", userId.toString());

      io.to(userSocketId).emit('mark-notification-read-response', { message: "All notifications have been marked as read.", userId: userId, hasUnread: false });

    } catch (error) {
      console.error('Error marking notification as read:', error);
      socket.emit('mark-notification-read-error', { message: error.message });
    }
  });

  socket.on('update-group-admin', async ({ roomId }) => {
    if (!roomId) {
      socket.emit('update-group-admin-error', { message: 'roomId is required.' });
      return;
    }

    try {
      const query = { $or: [] };

      if (mongoose.Types.ObjectId.isValid(roomId)) {
        query.$or.push({ _id: new mongoose.Types.ObjectId(roomId) });
      }
      query.$or.push({ participantsKey: roomId });

      const chatRoom = await ChatRoom.findOne(query);

      if (!chatRoom) {
        socket.emit('update-group-admin-error', { message: 'Chat room not found.' });
        return;
      }

      await Message.updateMany(
        { chatRoomId: chatRoom._id, seenBy: { $ne: userId } },
        { $push: { seenBy: new mongoose.Types.ObjectId(userId) } }
      );

      io.to(roomId).emit('messages-seen', { roomId, seenBy: userId });

    } catch (error) {
      console.error('Error marking messages as seen:', error);
      socket.emit('update-group-admin-error', { message: error.message });
    }
  });


  socket.on('check-user-online', async ({ userId }) => {
    if (!userId) {
      socket.emit('check-user-online-error', { message: 'userId is required.' });
      return;
    }

    const isOnline = await redisClient.hExists("onlineUsers", userId.toString());

    const lastActive = await redisClient.hGet("lastActiveUsers", userId);

    let loggedInUser = await User.findById(socket.data.userId).select('blockedUsers').lean();

    if (!loggedInUser) {
      loggedInUser = await Admin.findById(socket.data.userId).lean();
    }

    const opponentUser = await User.findById(userId).select('blockedUsers').lean();

    if (!loggedInUser) {
      socket.emit('check-user-online-error', { message: 'Logged-in user not found.' });
      return;
    }

    if (!opponentUser) {
      socket.emit('check-user-online-error', { message: 'User not found.' });
      return;
    }

    const loggedInBlockedUsers = (loggedInUser.blockedUsers || []).map(id => id.toString());
    const opponentBlockedUsers = (opponentUser.blockedUsers || []).map(id => id.toString());

    const isBlockedByLoggedIn = loggedInBlockedUsers.includes(userId);
    const isBlockedByOpponent = opponentBlockedUsers.includes(socket.data.userId);
    const isBlockedOneToOneChat = isBlockedByLoggedIn || isBlockedByOpponent;

    socket.emit('check-user-online-response', {
      userId,
      online: isOnline,
      lastActive,
      isBlockedOneToOneChat,
      isBlockedByLoggedIn
    });

    console.log("check-user-online-response sent successfully!!!!");
  });

  socket.on('disconnect', async () => {
    console.log('Socket disconnected:', socket.data.userId);

    if (socket.data.userId) {
      await redisClient.hDel("onlineUsers", socket.data.userId);

      const lastActiveTime = new Date().toISOString();
      await redisClient.hSet("lastActiveUsers", socket.data.userId, lastActiveTime);

      io.emit('online-user', {
        userId: socket.data.userId,
        online: false,
        lastActive: lastActiveTime
      });

    }
  });
};

module.exports = { socketUtiles };
