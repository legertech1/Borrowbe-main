module.exports = {
  validator: function (value) {
    return ["text", "number", "dropdown", "date", "checkbox", "radio"].includes(
      value
    );
  },
  message: "invalid value",
};
