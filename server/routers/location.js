const { Location } = require("../models/Location");
const express = require("express");
const router = new express.Router();
const { default: axios } = require("axios");

const parseAddressComponents = require("../utils/parseAddressComponents");
const verifyCoordinates = require("../utils/verifyCoordinates");

const CANADA_PROVINCES = [
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "British Columbia" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "NS", label: "Nova Scotia" },
  { value: "ON", label: "Ontario" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "QC", label: "Quebec" },
  { value: "SK", label: "Saskatchewan" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
  { value: "YT", label: "Yukon" },
];
const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District Of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

// fetch all the provinces
router.get("/provinces", async (req, res) => {
  const provinces = await Location.find({ type: "province" });
  res.send(provinces);
});

// fetch cities by province place_id
router.get("/cities/:name", async (req, res) => {
  const cities = await Location.find({
    type: "city",
    "components.administrative_area_level_1.long_name": req.params.name,
  });
  res.send(cities);
});

//find nearest location by lat and long
router.get("/nearest", async (req, res) => {
  const { lat, long } = req.query;
  const nearestLocation = await Location.findOne({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [long, lat],
        },
        $maxDistance: 50000,
      },
    },
  });
  res.send(nearestLocation);
});

// find nearest location by lat long and google map api
router.get("/find-my-location", async (req, res) => {
  const { lat, long, type } = req.query;
  if (!verifyCoordinates(lat, long, req.country))
    return res.status(400).send("bad request");

  let url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${long}&key=${process.env.REACT_APP_MAP_API_KEY}`;
  const response = await axios.get(url);
  const data = response.data;

  if (data.status === "OK" && data.results.length > 0) {
    // send first result
    res.send({
      name: extractAddressComponents(data.results[0]),
      place_id: data.results[0].place_id,
      coordinates: {
        lat: data.results[0].geometry.location.lat,
        long: data.results[0].geometry.location.lng,
      },
      types: data.results[0].types,
      components: parseAddressComponents(data.results[0].address_components),
    });
  } else {
    res.status(400).send({ error: "Invalid lat long" });
  }
});

// update provinces and cities in database

const fetchProvinces = async () => {
  let promises = [];

  for (const province of CANADA_PROVINCES) {
    promises.push(
      axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${province.label},Canada&key=${process.env.REACT_APP_MAP_API_KEY}`
      )
    );
  }
  for (const state of US_STATES) {
    promises.push(
      axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${state.label},USA&key=${process.env.REACT_APP_MAP_API_KEY}`
      )
    );
  }

  let responses = await Promise.all(promises);

  let provinceData = [];

  for (const response of responses) {
    let data = response.data;
    if (data.status === "OK" && data.results.length > 0) {
      let eachProvince = data.results[0];
      provinceData.push({
        name: eachProvince.formatted_address,
        place_id: eachProvince.place_id,
        type: "province",
        types: eachProvince.types,
        coordinates: {
          lat: eachProvince.geometry.location.lat,
          long: eachProvince.geometry.location.lng,
        },
        components: parseAddressComponents(eachProvince.address_components),
      });
    }
  }

  return provinceData;
};

const fetchCities = async (province) => {
  let cityData = [];
  const response = await axios.get(
    `https://maps.googleapis.com/maps/api/place/textsearch/json`,

    {
      params: {
        query: `cities in ${province.name}`,
        key: process.env.REACT_APP_MAP_API_KEY,
      },
    }
  );
  const cityResults = response.data.results;


  for (const city of cityResults) {
    const data = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json?address=" +
        city.formatted_address +
        "&key=" +
        process.env.REACT_APP_MAP_API_KEY
    );

    cityData.push({
      name: city.formatted_address,
      place_id: city.place_id,
      type: "city",
      types: city.types,
      coordinates: {
        lat: city.geometry.location.lat,
        long: city.geometry.location.lng,
      },
      components: parseAddressComponents(
        data.data.results[0].address_components
      ),
    });
  }
  return cityData;
};

function extractAddressComponents(item) {
  const { address_components } = item;
  let sublocalityLevel1 = null;
  let locality = null;
  let administrativeAreaLevel1 = null;

  for (const component of address_components) {
    const types = component.types;
    const longName = component.long_name;

    if (types.includes("neighborhood")) {
      sublocalityLevel1 = longName;
    } else if (types.includes("locality")) {
      locality = longName;
    } else if (types.includes("administrative_area_level_1")) {
      administrativeAreaLevel1 = longName;
    }
  }

  let address = "";
  if (sublocalityLevel1) address += `${sublocalityLevel1}, `;
  if (locality) address += `${locality}, `;
  if (administrativeAreaLevel1) address += `${administrativeAreaLevel1}`;

  return address;
}

async function updateLocations() {
  console.log(
    "------------------------------------updating locations------------------------------"
  );
  const provinces = await fetchProvinces();

  let cities = [];
  for (const province of provinces) {
    let provinceCities = await fetchCities(province);
    cities = cities.concat(provinceCities);
  }

  await Location.deleteMany({});
  await Location.insertMany(provinces);
  await Location.insertMany(cities);
  // res.send({ provinces, cities });
}

module.exports = router;
