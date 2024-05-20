module.exports = {
  validator: function (value) {
    return ["active", "inactive"].includes(value);
  },
  message: "value should be active or inactive",
};
