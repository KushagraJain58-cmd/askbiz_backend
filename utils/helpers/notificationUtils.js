const User = require("../../src/models/users");
const ChatRoom = require("../../src/models/chat");
const Community = require("../../src/models/community");
const { sendMulticastNotification } = require("../../src/config/notification");
const UserNotification = require("../../src/models/userNotification");
const mongoose = require("mongoose")



const isMuted = async (senderId, recipientId, communityId = null, chatRoomId = null) => {

    const recipient = await User.findById(recipientId).select(["mutedUsers", "mutedCommunities", "notificationOff"]);

    if (!recipient) return true;

    if (recipient.notificationOff) return true;

    if (recipient.mutedUsers.includes(new mongoose.Types.ObjectId(senderId))) return true;

    if (communityId && recipient.mutedCommunities.includes(new mongoose.Types.ObjectId(communityId))) return true;

    if (chatRoomId) {
        const chatRoom = await ChatRoom.findById(chatRoomId).select("participants");
        if (chatRoom) {
            const participant = chatRoom.participants.find(p => p.person.toString() === recipientId.toString());
            if (participant?.muteNotifications) return true;
        }
    }

    return false;
};


const sendOneToOneNotification = async (senderId, recipientId, title, message, payload, communityId = null, chatRoomId = null) => {

    if (await isMuted(senderId, recipientId, communityId, chatRoomId)) return;
    console.log("sendndnnnding");
    const recipient = await User.findById(recipientId).select("tokens");

    if (recipient?.tokens.length) {
        const fcmTokens = recipient.tokens.map(token => token.fcmToken).filter(Boolean);
        if (fcmTokens.length > 0) {
            
            await sendMulticastNotification(fcmTokens, title, message, payload);

            try {
                await UserNotification.create({
                    recipientId,
                    senderId,
                    type: payload?.type || null,
                    referenceId: payload?.referenceId || null,
                    referenceType: payload?.referenceType || null,
                    message,
                });
            } catch (error) {
                console.error("Error saving notification:", error);
            }

        }
    }
};

const sendUserBulkNotifications = async (senderId, recipientIds, title, message, payload, communityId = null, chatRoomId = null) => {

    if (!recipientIds.length) return;

    const filteredRecipients = [];
    for (const recipientId of recipientIds) {
        if (!(await isMuted(senderId, recipientId, communityId, chatRoomId))) {
            filteredRecipients.push(recipientId);
        }
    }

    console.log("filteredRecipients",filteredRecipients);

    if (!filteredRecipients.length) return;

    const recipients = await User.find({ _id: { $in: filteredRecipients } }).select("tokens");

    const tokens = recipients
    .flatMap(user => user.tokens.map(token => token.fcmToken))
    .filter(Boolean); 

    if (tokens.length === 0) return;

    await sendMulticastNotification(tokens, title, message, payload);
};


module.exports = { sendOneToOneNotification, sendUserBulkNotifications };
