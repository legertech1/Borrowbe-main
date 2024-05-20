const {
  defaultAdSort,
  adsPerReq,
  defaultAdsExclusion,
} = require("../../serverConstants");
const { Ad } = require("../models/Ad");

module.exports = async function getAds(
  filters,
  { sort, limit, page, select } = {}
) {
  const skip = (page - 1) * limit;
  return await Ad.find(filters)
    .sort(sort || defaultAdSort)
    .limit(limit || adsPerReq)
    .skip(skip || 0)
    .select(select || defaultAdsExclusion);
};
