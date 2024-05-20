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

    // let payload = {
    //   tokens: toUser.deviceTokens,
    //   notification: {
    //     title: fromUser?.firstName + " " + fromUser?.lastName,
    //     body: notification.message,
    //   },
    // };

    let title = ad.title.slice(0, 20);
    let body =
      notification.message.slice(0, 40) +
      " - " +
      fromUser?.firstName +
      " " +
      fromUser?.lastName;

    let payload = {
      tokens: toUser.deviceTokens,
      notification: {
        title: title,
        body: body,
        // imageUrl: "https://www.gstatic.com/webp/gallery/2.jpg",
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              // subtitle: "Honda Civic 2021",
              body: body,
              // launchImage: "https://www.gstatic.com/webp/gallery/1.jpg",
            },
            sound: "default",
            badge: 1,
          },
        },
      },
      android: {
        notification: {
          title: title,
          body: body,
          // imageUrl: "https://www.gstatic.com/webp/gallery/2.jpg",
          notificationCount: 1,
          sound: "default",
          // icon: "ic_launcher",
        },
      },
    };

    let r = await admin.messaging().sendMulticast(payload);
    console.log("r: ", r);
  } catch (error) {
    console.log("error: ", error);
  }
}

module.exports.sendPushNotification = sendPushNotification;
