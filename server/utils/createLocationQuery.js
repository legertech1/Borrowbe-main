module.exports = (location) => {
  if (!location || !location?.components) return {};
  let val = {};
  Object.keys(location.components).forEach((key) => {
    if (
      key == "locality" ||
      key == "administrative_area_level_1" ||
      key == "country"
    )
      val["location.components." + key] = location.components[key];
  });

  return val;
};
