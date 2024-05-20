const io = require("../../index");

module.exports = async function sendUpdate(type, update, id) {
  try {

    io.to(id.toString()).emit("send_update", { type, update });
  } catch (err) {
    console.log(err);
  }
};
