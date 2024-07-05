const { uploadImage } = require("../AWS");
const memo = require("../memo");
const { Ad } = require("../models/Ad");
const { Chat } = require("../models/Chat");
const { Notification } = require("../models/Notifications");
const { User } = require("../models/User");
const { sendPushNotification } = require("../utils/sendNotification");

async function sendChats(socket, channel) {
  const chats = await Chat.find({
    participants: { $in: [socket.user._id] },
    messages: { $ne: [] },
    deletedBy: { $nin: [socket?.user?._id] },
  })
    .sort({ updatedAt: -1 })
    .lean();
  const people = [];
  const ads = [];

  for (let i = 0; i < chats.length; i++) {
    socket.join(chats[i]._id.toString());
    people.push(
      chats[i].participants.filter((i) => i != socket.user._id.toString())[0] ||
        ""
    );
    ads.push(chats[i].ad || "");
  }
  const userDocs = await User.find({ _id: { $in: people } }).lean();
  const adDocs = await Ad.find({ _id: { $in: ads } }).lean();

  const userMap = {};
  const adMap = {};
  for (let i = 0; i < chats.length; i++) {
    userMap[userDocs[i]?._id || "_"] = userDocs[i];
    adMap[adDocs[i]?._id || "_"] = adDocs[i];
  }

  let data = [];
  for (chat of chats) {
    const parsed = await parseChat(
      chat,
      socket.user._id.toString(),
      userMap[
        chat.participants.filter((i) => i != socket.user._id.toString())[0]
      ] || {
        firstName: "Deleted",
        lastName: "User",
        _id: "",
        nickname: "",
        image: "",
      },
      adMap[chat.ad] || {
        title: "Ad has been deleted",
        image: "",
        thumbnails: [""],
        location: { name: "" },
        price: "",
        term: "",
      }
    );
    if (parsed) data.push(parsed);
  }

  channel ? channel.emit("send_chats", data) : socket.emit("send_chats", data);
}

async function parseChat(chat, user, _person, _ad) {
  if (chat._doc) chat = chat._doc;
  const person =
    _person ||
    (await User.findOne(
      {
        _id: chat?.participants?.filter((i) => i != user)[0],
      },
      { _id: 1, firstName: 1, nickname: 1, image: 1, lastName: 1 }
    ).lean());
  if (!person) return null;
  const ad =
    _ad ||
    (await Ad.findOne(
      { _id: chat.ad },
      { images: 0, extraFields: 0, config: 0, meta: 0 }
    ).lean());
  if (!ad) return null;
  return {
    ...chat,
    info: {
      firstName: person.firstName,
      lastName: person.lastName,
      nickname: person.info?.nickname || null,
      _id: person._id,
      image: person.image,
    },
    ad: {
      ...ad,
      thumbnails: [],
      extraFields: [],
      image: ad.thumbnails[0],
    },
    messages:
      chat.messages[chat.messages.length - 1].read != true
        ? [...chat.messages.filter((m) => m.read != true)]
        : [chat.messages[chat.messages.length - 1]],
    messagesLength: chat.messages.length,
  };
}

function verifyUser(socket, chatId) {
  return Array.from(socket.rooms).includes(chatId);
}

module.exports = function (socket) {
  socket.join(socket?.user?._id?.toString());

  socket.on("send_message", async (message) => {
    try {
      if (message.from != socket.user._id) return;
      if (message.from == message.to) return;
      if (message.message == "") return;
      if (!message.ad) return;
      if (!message.type) return;
      //
      if (message.type == "image") {
        message.message = await uploadImage(message.message);
      }
      if (message.type == "text")
        message.message = message.message.slice(0, 2000);

      let conversation = await Chat.findOne({
        participants: {
          $all: [message.from, message.to],
        },
        ad: message.ad,
      });

      if (!conversation) {
        let reciever = await User.findOne({ _id: message.to });
        if (!reciever) return;
        conversation = new Chat({
          participants: [message.from, message.to],
          messages: [message],
          ad: message.ad,
        });
      } else {
        conversation.messages.push(message);
      }

      if (conversation.blockedBy.length > 0) return;

      await conversation.save();
      socket.join(conversation._id.toString());
      if (conversation.messages.length == 1) {
        const chat1 = await parseChat(conversation._doc, message?.from);
        const chat2 = await parseChat(conversation._doc, message?.to);

        socket.nsp.in(message?.from).emit("new_chat", chat1);
        socket.nsp.in(message?.to).emit("new_chat", chat2);
      } else {
        socket.nsp.in(conversation._id.toString()).emit("receive_message", {
          message: conversation.messages.slice(-1)[0],
          updatedAt: conversation.updatedAt,
          _id: conversation._id,
        });
      }
      if (conversation.deletedBy.length) {
        const deletedBy = [...conversation.deletedBy];
        conversation.deletedBy = [];
        await conversation.save();
        deletedBy.forEach(async (id) => {
          const chat = await parseChat(conversation, id.toString());
          socket.nsp.in(id.toString()).emit("new_chat", chat);
        });
      }
      await sendPushNotification(message, message.to, message.from, message.ad);
    } catch (error) {
      console.log("error: ", error);
    }
  });

  socket.on("load_chats", async () => {
    sendChats(socket);
  });

  socket.on("typing", ({ userId, chatId }) => {
    verifyUser(socket, chatId);
    socket.nsp.in(chatId).emit("user_typing", { userId, chatId });
  });
  socket.on("stopped_typing", ({ userId, chatId }) => {
    verifyUser(socket, chatId);
    socket.nsp.in(chatId).emit("user_stopped_typing", { userId, chatId });
  });

  socket.on("load_messages", async ({ chatId, limit, page }) => {
    let lmt = limit || 20;
    let pg = page || 1;
    let chat = await Chat.findOne({ _id: chatId });
    if (!chat) return;

    const totalMessages = chat.messages.length;

    const startIndex = Math.max(0, totalMessages - lmt * pg);
    const endIndex = totalMessages - lmt * (pg - 1);

    let messagesToSend = chat.messages.slice(startIndex, endIndex);

    if (endIndex === totalMessages && totalMessages < lmt) {
      messagesToSend = chat.messages.slice(0, totalMessages);
    }

    socket.emit("send_messages", {
      messages: messagesToSend,
      _id: chatId,
    });
  });

  socket.on("block_chat", async ({ userId, chatId }) => {
    verifyUser(socket, chatId);
    const chat = await Chat.findOne({ _id: chatId });
    chat.blockedBy = [...chat.blockedBy.filter((x) => x != userId), userId];

    await chat.save();
    let data = await parseChat(chat, socket.user._id.toString());
    socket.nsp.in(chatId).emit("chat_blocked", data);
  });
  socket.on("unblock_chat", async ({ userId, chatId }) => {
    verifyUser(socket, chatId);
    const chat = await Chat.findOne({ _id: chatId });
    chat.blockedBy = [...chat.blockedBy.filter((x) => x != userId)];

    await chat.save();
    let data = await parseChat(chat, socket.user._id.toString());

    socket.nsp.in(chatId).emit("chat_unblocked", data);
  });
  socket.on("delete_chat", async (chatId) => {
    verifyUser(socket, chatId);
    await Chat.findOneAndUpdate(
      { _id: chatId },
      { $push: { deletedBy: socket?.user?._id } }
    );

    socket.emit("chat_deleted", chatId);
  });

  socket.on("message_read", async (chatId, messageId) => {
    verifyUser(socket, chatId);

    const chat = await Chat.findOneAndUpdate(
      { _id: chatId },
      { $set: { "messages.$[x].read": true } },
      {
        multi: true,
        arrayFilters: [{ "x._id": messageId, "x.to": socket?.user?._id }],
        new: true,
      }
    );
    const message = chat.messages.reduce(
      (a, m) => (m._id == messageId ? m : a),
      null
    );
    socket.nsp.in(chatId).emit("user_read_message", { chatId, message });
  });

  socket.on("delete_message", async (chatId, messageId) => {
    verifyUser(socket, chatId);

    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const chat = await Chat.findOneAndUpdate(
      { _id: chatId },
      {
        $set: { "messages.$[x].type": "deleted", "messages.$[x].message": "." },
      },
      {
        multi: true,
        arrayFilters: [
          {
            "x._id": messageId,
            "x.from": socket?.user?._id,
            "x.createdAt": { $gte: twoHoursAgo },
          },
        ],
        new: true,
      }
    );
    const message = chat.messages.reduce(
      (a, m) => (m._id == messageId ? m : a),
      null
    );
    socket.nsp.in(chatId).emit("user_deleted_message", { chatId, message });
  });

  socket.on("get_notifications", async (page) => {
    let notifications = await Notification.findOne({
      user: socket?.user?._id,
    });
    if (!notifications) {
      notifications = new Notification({ user: socket.user._id, data: [] });
      await notifications.save();
    }
    if (notifications?.data?.length > 50) {
      notifications.data = notifications.data.slice(
        notifications.data.length - 50,
        notifications.data.length
      );
      await notifications.save();
    }
    socket.emit("load_notifications", notifications?.data || []);
  });

  socket.on("notification_read", async (id) => {
    const notifications = await Notification.findOneAndUpdate(
      {
        user: socket?.user?._id,
      },
      { $set: { "data.$[x].read": true } },
      {
        multi: true,
        arrayFilters: [{ "x._id": id }],
        new: true,
      }
    );
    socket.emit(
      "notification_update",
      notifications?.data?.reduce((acc, i) => (i._id == id ? i : acc), null) ||
        {}
    );
  });
  socket.on("delete_notification", async (notif) => {
    const notifications = await Notification.findOneAndUpdate(
      {
        user: socket?.user?._id,
      },
      { $pull: { data: notif } },
      {
        new: true,
      }
    );

    socket.emit("notification_deleted", notif._id);
  });
};
