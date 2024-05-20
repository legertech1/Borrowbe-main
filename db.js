const mongoose = require("mongoose");
// mongoose.set("debug", true);
console.log(process.env.PRIMARY_DB_URI, process.env.SECONDARY_DB_URI)

// Create connections to primary and secondary databases
const primaryDB = mongoose.createConnection(process.env.PRIMARY_DB_URI, {
  useNewUrlParser: true,
});
const secondaryDB = mongoose.createConnection(process.env.SECONDARY_DB_URI, {
  useNewUrlParser: true,
});

// Log connection status
// primaryDB.on("connected", () => console.log("Connected to Primary DB"));
// secondaryDB.on("connected", () => console.log("Connected to Secondary DB"));

// Export connections
module.exports = {
  primaryDB,
  secondaryDB,
};
