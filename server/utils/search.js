const { default: mongoose } = require("mongoose");
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
  if (query[0] == "/") {
    query[0] == "";
  }

  if (query[query.length - 1] == "/") {
    query[query.length - 1] == "";
  }
  const locationQuery = location?.radius
    ? createGeoConstructQuery(location)
    : createLocationQuery(location);

  let def = { ...defaultQuery };
  if (ignoreStatus) {
    def["meta.status"] = /.*/;
  }

  const resultPipeline = [];

  // Add $search stage if query is provided
  if (query) {
    const fuzzySearchQuery = {
      index: "default",
      text: {
        query: query,
        path: ["title",  "tags"],
        fuzzy: {
          maxEdits: 2, // Adjust as needed
          maxExpansions: 100, // Adjust as needed
        },
      },
    };

    resultPipeline.push({ $search: fuzzySearchQuery });
  }
  try {
    if (additional.user) {
      const arr = [];
      for (let i of additional.user) {
        arr.push(new mongoose.Types.ObjectId(i));
      }

      additional.user = { $in: arr };
    }

    if (additional._id) {
      const arr = [];
      for (let i of additional._id) {
        arr.push(new mongoose.Types.ObjectId(i));
      }
      additional._id = { $in: arr };
    }
  } catch (err) {
    res.status(400).send("request syntax error");
  }

  // Add $match stage
  const matchStage = {
    $match: {
      ...def,
      ...locationQuery,
      "meta.category":
        category === "All Categories" ? { $exists: true } : category,
      "meta.subCategory": subCategory || { $exists: true },
      "meta.country": restrictCountry ? country : { $exists: true },
      ...filters,
      ...additional,
    },
  };
  resultPipeline.push(matchStage);

  if (additional._id) {
    const sortOrder = additional._id.$in.map((id) => id.toString());
    resultPipeline.push({
      $addFields: {
        sortOrderIndex: {
          $indexOfArray: [sortOrder, { $toString: "$_id" }],
        },
      },
    });
    resultPipeline.push({ $sort: { sortOrderIndex: -1 } });
  }
  // Add $sort, $skip, $limit, and $project stages
  if (sort !== null && !additional._id) {
    resultPipeline.push({
      $sort: sort || defaultAdSort,
    });
  }

  if (select) {
    const projectStage = { $project: select || {} };
    resultPipeline.push(projectStage);
  }

  const countPipeline = [...resultPipeline, { $count: "total" }];
  const countResult = await Ad.aggregate(countPipeline).exec();
  const total = countResult.length > 0 ? countResult[0].total : 0;

  const pages = total / (limit || adsPerReq);

  if (random) page = getRandomNumber(1, pages - 1);

  if (page < 1) page = 1;
  resultPipeline.push({
    $skip: (page - 1) * (limit || adsPerReq),
  });
  resultPipeline.push({
    $limit: limit || adsPerReq,
  });
  // Execute the result aggregation pipeline
  const results = await Ad.aggregate(resultPipeline).exec();

  // Count total documents using a separate aggregation pipeline

  // Adjust page number if random is true and ensure it's within valid range

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
