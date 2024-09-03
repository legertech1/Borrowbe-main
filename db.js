const mongoose = require("mongoose");
// mongoose.set("debug", true);
console.log(process.env.PRIMARY_DB_URI, process.env.SECONDARY_DB_URI);

// Create connections to primary and secondary databases
const primaryDB = mongoose.createConnection(process.env.PRIMARY_DB_URI, {
  useNewUrlParser: true,
});
const secondaryDB = mongoose.createConnection(process.env.SECONDARY_DB_URI, {
  useNewUrlParser: true,
});
async function listCollections(dbConnection) {
  try {
    // Access the native MongoDB database object
    await dbConnection.asPromise();
    const collections = await dbConnection.db.listCollections().toArray();
    const collectionNames = collections.map((collection) => collection.name);
    return collectionNames;
  } catch (error) {
    console.error(error);
  }
}

// List collections for both primary and secondary databases

// Export connections
module.exports = {
  primaryDB,
  secondaryDB,
  listCollections,
};
