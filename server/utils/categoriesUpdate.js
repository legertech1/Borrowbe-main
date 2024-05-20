const io = require("../../index");

module.exports = async function (categories) {
  io.emit("send_categories", categories);
};
