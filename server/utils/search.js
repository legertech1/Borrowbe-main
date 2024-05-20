const {
  defaultQuery,
  defaultSelection,
  defaultAdSort,
  adsPerReq,
} = require("../../serverConstants");

const { Ad } = require("../models/Ad");
const { Statistics } = require("../models/AdStatistics");
const createGeoConstructQuery = require("./createGeoConstructQuery");
const createLocationQuery = require("./createLocationQuery");

module.exports = async function ({
  query = "",
  location = null,
  filters = {},
  category = "",
  subCategory,
  additional,
  sort,
  select,
  page = 1,
  limit,
  count = false,
  ignoreStatus = false,
  analytics = false,
  random = false,
  restrictCountry,
  country,
}) {
  query = removeSlashes(query);
  const locationQuery = location?.radius
    ? createGeoConstructQuery(location)
    : createLocationQuery(location);

  let def = { ...defaultQuery };
  if (ignoreStatus) {
    def["meta.status"] = /.*/;
  }

  const databaseQuery = {
    ...def,
    ...locationQuery,
    "meta.category": category == "All Categories" ? /.*/ : category || /.*/,
    "meta.subCategory": subCategory || /.*/,
    $or: [
      { title: new RegExp(query, "i") },
      { description: new RegExp(query, "i") },
      { tags: { $in: [query] } },
      { listingID: query },
    ],
    ...filters,
    ...additional,
    "meta.country": restrictCountry ? country : /.*/,
  };

  const total = count ? await Ad.countDocuments(databaseQuery) : null;
  const pages = total / (limit || adsPerReq);
  if (random) page = getRandomNumber(1, pages - 1);
  if (page < 1) page = 1;
  const results = await Ad.find(databaseQuery)
    .sort(sort || defaultAdSort)
    .limit(limit || adsPerReq)
    .skip((page - 1) * (limit || adsPerReq))
    .select(select || defaultSelection)
    .lean();

  if (analytics) {
    let stats = await Statistics.find({
      ad: { $in: results.map((i) => i._id) },
    })
      .sort({ ad: 1 })
      .lean();
    const obj = {};
    stats.map((i) => {
      obj[i.ad] = i;
    });
    results.map((res) => (res.analytics = obj[res._id]));
  }

  return { results, total, page };
};
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function removeSlashes(str) {
  // Use a regular expression to remove slashes from the start and end of the string
  return str.replace(/^\/+|\/+$/g, "");
}
