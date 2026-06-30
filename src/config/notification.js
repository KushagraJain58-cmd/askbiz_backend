const admin = require("firebase-admin");
const serviceAccount = require("../../askbiz-firebase.json");
const User = require("../../src/models/users");
const NotificationAlert = require("../../src/models/notificationAlert")

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const sendNotification = async (token, title, body, data = {}) => {
    try {
        const message = {
            notification: {
                title: title,
                body: body,
            },
            data: {
                title: title,
                body: body,
                ...data
            },
            token: token,
        };

        if (data.platform === "ios") {
            message.apns = {
                headers: {
                    'apns-priority': '10', // High priority for iOS
                },
                payload: {
                    aps: {
                        sound: "default",
                    },
                },
            };
        } else if (data.platform === "android") {
            message.android = {
                priority: 'high', // High priority for Android
            };
        }

    admin.messaging().send(message)
        .then(async (response) => {
            console.log('Successfully sent message:', response);
        })
        .catch((error) => {
            console.log('Error sending message:', error);
        })
        
    } catch (error) {
        console.error("Error sending message:", error);
    }
};


const sendMulticastNotification = async (tokens, title, body, data = {}) => {
    if (!tokens || tokens.length === 0) {
        console.log("No tokens provided for push notification.");
        return;
    }

    const message = {
        data: { 
            title,
            body,
            ...data,
        },
        tokens,
        android: {
            // notification: {
            //     sound: "default",
            //     priority: 'high',
            //     color: "#1465FE", 
            //     icon: "ic_launcher"
            // },
            priority: 'high'
        },
        apns: {
            headers: {
                'apns-priority': '10',
            },
            payload: {
                aps: {
                    alert: {
                        title,
                        body,
                    },
                    sound: "default",
                    contentAvailable: false,
                },
            },
        },
    };
    
    

    try {
        const response = await admin.messaging().sendEachForMulticast(message);

        const successTokens = response.responses
            .map((res, idx) => (res.success ? tokens[idx] : null))
            .filter(Boolean);

        console.log(`Successfully sent notifications: ${response.successCount} out of ${tokens.length}`);

        if (successTokens.length > 0 && data.notificationAlertId) {
            const users = await User.find({ "tokens.fcmToken": { $in: successTokens } }).select("_id");
            const userIds = users.map(user => user._id);

            await NotificationAlert.findByIdAndUpdate(
                data.notificationAlertId,
                { 
                    $set: { sentOn: new Date() },
                    $addToSet: { toUsers: { $each: userIds } }
                }
            );
        }

        if (response.failureCount > 0) {
            const failedTokens = response.responses
                .map((res, idx) => (!res.success ? tokens[idx] : null))
                .filter(Boolean);

            console.log("List of tokens that caused failures:", failedTokens);
        }

    } catch (error) {
        console.error("Error sending multicast notification:", error);
    }
};


module.exports = {
    sendNotification,
    sendMulticastNotification
}