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

const sendFCMNotification = async (tokens, { title, body }) => {
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
