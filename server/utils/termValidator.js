module.exports = {
    validator: function (value) {
      return ["day", "month" , "year"].includes(value);
    },
    message: "value should be day, month or year",
  };
  