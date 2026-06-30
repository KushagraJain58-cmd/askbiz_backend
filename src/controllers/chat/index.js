const chatController = require('./chat');

module.exports = {
    createRoom : chatController.createRoom,
    getChats : chatController.getChats,
    getChatMessages : chatController.getChatMessages,
    getChatRoomDetails : chatController.getChatRoomDetails,
    getChatRoomDetailsForUser : chatController.getChatRoomDetailsForUser,
    sendMessage : chatController.sendMessage,
    addPersonToGroup : chatController.addPersonToGroup,
    deleteSingleMessage : chatController.deleteSingleMessage,
    deleteChatRoomByParticipent : chatController.deleteChatRoomByParticipent,
    clearChat : chatController.clearChat,
    makeAnAdminorRemove : chatController.makeAnAdminorRemove,
    updateGroup : chatController.updateGroup,
    getUsersForChat : chatController.getUsersForChat,
    getMessageRequests : chatController.getMessageRequests,
    actionOnMessageRequest : chatController.actionOnMessageRequest,
    leaveChatGroup : chatController.leaveChatGroup,
    getPaticipentList : chatController.getPaticipentList,
    sendGroupInvite : chatController.sendGroupInvite,
    toggleMuteChatNotification : chatController.toggleMuteChatNotification,
    getUnseenChatRoomsCount : chatController.getUnseenChatRoomsCount,
};
