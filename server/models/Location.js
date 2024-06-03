const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");

const addressComponent = new mongoose.Schema(
  {
    short_name: String,
    long_name: String,
  },
  { _id: false }
);

const componentsSchema = new mongoose.Schema(
  {
    country: {
      type: addressComponent,
    },
    administrative_area_level_2: addressComponent,
    administrative_area_level_3: addressComponent,
    postal_code: addressComponent,
    locality: addressComponent,
    route: addressComponent,
    neighbourhood: addressComponent,
    sublocality: addressComponent,
    street_number: addressComponent,
    subpremise: addressComponent,
    administrative_area_level_1: {
      type: addressComponent,
    },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    place_id: {
      type: String,
      required: true,
    },
    coordinates: {
      lat: {
        type: Number,
        required: true,
      },
      long: {
        type: Number,
        required: true,
      },
    },
    type: {
      type: String,
    },
    types: [String],

    components: { type: componentsSchema, required: true, default: {} },
    geoPoint: {
      type: {
        type: String,
        enum: ["Point"], // GeoJSON type should be 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]7
        // required: true,ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
      },
    },
    hash: String,
  },
  { _id: false, versionKey: false }
);

locationSchema.index({ geoPoint: "2dsphere" });
const Location = db.model("Location", locationSchema);

module.exports = { Location, locationSchema, addressComponent };
