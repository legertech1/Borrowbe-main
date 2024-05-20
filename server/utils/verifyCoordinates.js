const googleMapsClient = require("@google/maps").createClient({
  key: process.env.REACT_APP_MAP_API_KEY,
  // Set your API key here
  // Note: It's recommended to use environment variables to store sensitive data like API keys
});
module.exports = function verifyCoordinates(latitude, longitude, countryCode) {
  return new Promise((resolve, reject) => {
    googleMapsClient.reverseGeocode(
      {
        latlng: [latitude, longitude],
        result_type: "country",
        language: "en", // Optional: specify the language for the result
      },
      function (err, response) {
        if (!err) {
          if (response.json.results.length > 0) {
            const addressComponents =
              response.json.results[0].address_components;
            const isInCountry = addressComponents.some((component) => {
              return (
                component.types.includes("country") &&
                component.short_name === countryCode
              );
            });
            resolve(isInCountry);
          } else {
            reject(new Error("No results found"));
          }
        } else {
          reject(err);
        }
      }
    );
  });
};
