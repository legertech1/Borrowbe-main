const values = ["active", "inactive", "expired", "paused"];

module.exports = {
  validator: function (value) {
    return values.includes(value);
  },
  message: "value should be one of the following values: " + values.toString(),
};
