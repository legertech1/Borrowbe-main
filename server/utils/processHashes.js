const crypto = require("crypto");
function createHash(obj) {
  // Create a shallow copy of the object to avoid modifying the original
  const objCopy = sortObject(convertToPlainObject(obj));
  if (objCopy.hash) delete objCopy.hash;
  if (objCopy._id) delete objCopy._id;
  if (objCopy.__v) delete objCopy.__v;
  if (objCopy.updatedAt) delete objCopy.updatedAt;
  if (objCopy.createdAt) delete objCopy.createdAt;
  objCopy.passkey = process.env.HASH_PASSKEY;

  // Sort the keys to ensure consistent order
  const sortedKeys = Object.keys(objCopy).sort();

  // Create an array of key-value pairs
  const keyValuePairs = sortedKeys.map((key) => [key, objCopy[key]]);

  // Create a string representation of the sorted key-value pairs
  const stringifiedObject = JSON.stringify(keyValuePairs);

  // Create the hash
  const hash = crypto.createHash("sha256");
  hash.update(stringifiedObject);
  return hash.digest("hex");
}
function verifyHash(obj) {
  return obj.hash == createHash(obj);
  // return hash == createHash(obj);
}

function sortObject(obj) {
  if (typeof obj !== "object" || obj == null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObject);
  }

  const sortedKeys = Object.keys(obj).sort();
  const sortedObj = {};
  sortedKeys.forEach((key) => {
    sortedObj[key] = sortObject(obj[key]);
  });

  return sortedObj;
}

function convertToPlainObject(doc) {
  return JSON.parse(JSON.stringify(doc));
}

module.exports = { createHash, verifyHash };
