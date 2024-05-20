module.exports = {
  validator: function (value) {
    return ["USD", "CAD"].includes(value);
  },
  message: "value should be USD or CAD",
};
