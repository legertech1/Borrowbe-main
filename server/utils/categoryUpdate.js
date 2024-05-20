const io = require("../../index");

module.exports = async function (category) {
  io.emit("category_update", category);
};
