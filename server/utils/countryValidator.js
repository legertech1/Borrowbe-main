module.exports = {
  validator: function (value) {
    return ["US", "CA"].includes(value);
  },
  message: "value should be US or CA",
};
