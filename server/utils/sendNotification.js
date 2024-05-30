const io = require("../../index");
const { Notification } = require("../models/Notifications");
var admin = require("firebase-admin");
const { User } = require("../models/User");
var serviceAccount = require("../../service_account.json");
const { Ad } = require("../models/Ad");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = async function (notification, id) {
  try {
    let userNotifications = await Notification.findOneAndUpdate(
      {
        user: id,
      },
      { $push: { data: notification } }
    );

    io.to(id.toString()).emit("send_notification", {
      ...notification,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.log(err);
  }
};

async function sendPushNotification(notification, to, from, adId) {
  try {
    if (notification.type !== "text") return;

    const toUser = await User.findById(to);
    const fromUser = await User.findById(from);
    const ad = await Ad.findById(adId);
    if (!toUser || !toUser?.deviceTokens) return;
    let tokens = toUser.deviceTokens;
    let title = ad.title.slice(0, 20);
    let body =
      notification.message.slice(0, 40) +
      " - " +
      fromUser?.firstName +
      " " +
      fromUser?.lastName;

    return await sendFCMNotification(tokens, { title, body });
  } catch (error) {
    console.log("error: ", error);
  }
}

const sendFCMNotification = async (rawTokens, { title, body }) => {
  let tokens = [];

  // deviceTokens: [
  //   {
  //     deviceUID: '21902229d7eaa789',
  //     token: 'dCJJTv0-RyeYC5l4msV4rM:APA91bEkd3GDKK00DVpjvP5AgyWBCJfIvjmEBRJpJn-1PK5qNUsHRAVvR5TM0mEoVOC5fvSQotlEJBqwm1zdKMrW7VRlPwxGB9SNy0_hZ-EHCU1L8W4Uumn2rwuhol9Uwb75AuToqpHU',
  //     _id: new ObjectId("665877d5dc39949ec5c6d221")
  //   }
  // ]

  // if rawTokens contains array of strings then do nothing
  if (typeof rawTokens[0] === "string") {
    tokens = rawTokens;
  } else {
    // if rawTokens contains array of objects then extract token from each object
    tokens = rawTokens.map((token) => token.token);
  }
  console.log("tokens: ", tokens);

  try {
    let payload = {
      tokens: tokens,
      notification: {
        title: title,
        body: body,
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: body,
            },
            sound: "default",
          },
        },
      },
      android: {
        notification: {
          title: title,
          body: body,
          sound: "default",
        },
      },
    };

    let r = await admin.messaging().sendMulticast(payload);
    console.log("r: ", r);

    return r;
  } catch (error) {
    console.log("error: ", error);
  }
};

module.exports.sendPushNotification = sendPushNotification;
module.exports.sendFCMNotification = sendFCMNotification;
