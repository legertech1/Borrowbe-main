const { primaryDB: mongoose } = require("../../db");

/**
 * Paginate results using aggregation pipeline.
 * @param {string} collectionName - The name of the collection to query.
 * @param {Array} aggregationPipeline - The aggregation pipeline stages.
 * @param {object} options - Options object with default values for filters, pageNumber, and limit.
 * @returns {Promise<object>} - Returns an object with paginated results and pagination metadata.
 */
async function paginateWithAggregation(
  collectionName,
  aggregationPipeline,
  options = {}
) {
  const { filters = {}, pageNumber = 1, limit = 10 } = options;

  const collection = mongoose.model(collectionName);

  try {
    // Clear existing data in the collection (optional)

    // Add filters to the aggregation pipeline
    if (Object.keys(filters).length > 0) {
      aggregationPipeline.push({
        $match: filters,
      });
    }

    // Perform aggregation with pagination
    const response = await collection.aggregate([
      ...aggregationPipeline,
      {
        $facet: {
          paginatedResults: [
            { $skip: (pageNumber - 1) * limit },
            { $limit: limit },
          ],
          totalCount: [
            {
              $count: "value",
            },
          ],
        },
      },
    ]);

    // Extract paginated results and total count
    const paginatedResults = response[0].paginatedResults;
    const totalCount = response[0].totalCount[0]?.value || 0; // Extract total count

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalCount / limit);

    const pagination = {
      totalResults: totalCount,
      totalPages: totalPages,
      currentPage: pageNumber,
    };

    return { data: paginatedResults, pagination: pagination };
  } catch (error) {
    console.error("Error paginating data:", error);
    throw error;
  }
}

module.exports = { paginateWithAggregation };

// // Example usage
// const { paginateWithAggregation } = require('./pagination-helper');

// const collectionName = 'users'; // Replace with the name of the collection you want to query
// const aggregationPipeline = [
//   {
//     $lookup: {
//       from: 'ads',
//       localField: '_id',
//       foreignField: 'user',
//       as: 'userAds',
//     },
//   },
//   {
//     $project: {
//       userAdsCount: { $size: '$userAds' },
//       user: '$$ROOT',
//     },
//   },
//   {
//     $project: {
//       'user.userAds': 0,
//       'user.image': 0,
//     },
//   },
// ]; // Add your aggregation stages
// const options = {
//   filters: { /* Your filters here */ },
//   pageNumber: 1,
//   limit: 10,
// };

// paginateWithAggregation(collectionName, aggregationPipeline, options)
//   .then((result) => {
//     console.log('Paginated data:', result);
//   })
//   .catch((error) => {
//     console.error('Error:', error);
//   });
