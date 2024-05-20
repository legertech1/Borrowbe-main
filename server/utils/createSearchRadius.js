function reverseHaversine(lat1, lon1, distance, bearing) {
  const R = 6371; // Earth's radius in kilometers

  // Convert distance to radians
  const d = distance / R;

  // Convert bearing to radians
  const brng = (bearing * Math.PI) / 180;

  // Convert latitude and longitude to radians
  lat1 = (lat1 * Math.PI) / 180;
  lon1 = (lon1 * Math.PI) / 180;

  // Calculate new latitude and longitude
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  // Convert back to degrees
  const newLat = (lat2 * 180) / Math.PI;
  const newLon = (lon2 * 180) / Math.PI;

  return { latitude: newLat, longitude: newLon };
}

module.exports = function createSearchRadius(lat, lng, radius) {
  const c1 = reverseHaversine(lat, lng, radius, 0);
  const c2 = reverseHaversine(lat, lng, radius, 90);
  const c3 = reverseHaversine(lat, lng, radius, 180);
  const c4 = reverseHaversine(lat, lng, radius, 270);

  return {
    "location.coordinates.lat": { $gt: c3.latitude, $lt: c1.latitude },
    "location.coordinates.long": { $gt: c4.longitude, $lt: c2.longitude },
  };
};
