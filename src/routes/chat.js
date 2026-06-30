let express = require("express");
let jwtMiddleware = require("../middelwares/jwt");

const chatController = require("../controllers/chat");

let chatRouter = express.Router();


chatRouter.post('/createChat', chatController.createRoom);

chatRouter.put('/updateGroup', chatController.updateGroup);

chatRouter.get('/getChats', chatController.getChats);

chatRouter.get('/getChatMessages', chatController.getChatMessages);

chatRouter.post('/sendMessage', chatController.sendMessage);

chatRouter.put('/addPersonToGroup', chatController.addPersonToGroup);

chatRouter.put('/deleteSingleMessage', chatController.deleteSingleMessage);

chatRouter.put('/deleteChat', chatController.deleteChatRoomByParticipent)

chatRouter.put('/clearChat', chatController.clearChat)

chatRouter.post('/makeAnAdminorRemove', chatController.makeAnAdminorRemove)

chatRouter.get('/getUsersForChat', chatController.getUsersForChat)

chatRouter.get('/getChatRoomDetails', chatController.getChatRoomDetails)

chatRouter.get('/getChatRoomDetailsForUser', chatController.getChatRoomDetailsForUser)

chatRouter.get('/getMessageRequests', chatController.getMessageRequests)

chatRouter.post('/actionOnMessageRequest', chatController.actionOnMessageRequest)

chatRouter.put('/leaveChatGroup', chatController.leaveChatGroup);

chatRouter.get('/getPaticipentList', chatController.getPaticipentList);

chatRouter.post('/sendGroupInvite', chatController.sendGroupInvite);

chatRouter.put('/toggleMuteChatNotification', chatController.toggleMuteChatNotification);

chatRouter.get('/getUnseenChatRoomsCount', chatController.getUnseenChatRoomsCount);





module.exports = chatRouter;