module.exports = (location) => {
  if (!location) return {};
  return {
    "location.geoPoint": {
      $geoWithin: {
        $centerSphere: [
          [location.coordinates.long, location.coordinates.lat], // coordinates of the center
          kilometersToRadians(location.radius), // radius in radians
        ],
      },
    },
  };
};
function kilometersToRadians(kilometers) {
  const earthRadiusInKilometers = 6371;
  return kilometers / earthRadiusInKilometers;
}
