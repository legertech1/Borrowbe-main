module.exports = {
  batchSize: 1000,
  adsPerReq: 30,
  defaultAdSort: { "meta.listingRank": -1 },
  defaultSelection: "",
  defaultQuery: { "meta.status": "active" },
  defaultNotificationConfig: {
    "account updates": true,
    "ad has expired": true,
    "ad is posted": true,
    "auto-relist status changed": true,
    "auto-relisted successfully": true,
    "auto-relist failed": true,
  },
  defaultEmailConfig: {
    "ad has expired": true,
    "new message recieved": true,
    "account updates": true,
  },
  defaultCategoryPricing: {
    Basic: {
      price: 19.99,
      freeAds: 3,
      images: 12,
      bumpUpFrequency: 0,
      featured: 0,
      highlighted: 0,
      homepageGallery: 0,
    },
    Standard: {
      price: 39.99,
      freeAds: 0,
      images: 20,
      bumpUpFrequency: 14,
      featured: 7,
      highlighted: 0,
      homepageGallery: 3,
    },
    Premium: {
      price: 99.99,
      freeAds: 0,
      images: 30,
      bumpUpFrequency: 7,
      featured: 14,
      highlighted: 14,
      homepageGallery: 7,
    },
    AddOns: {
      bumpUp: [
        {
          price: 29.99,
          frequency: 7,
        },
      ],
      highlighted: [
        {
          price: 29.99,
          days: 14,
        },
      ],
      featured: [
        {
          price: 19.99,
          days: 7,
        },
      ],
      homepageGallery: [
        {
          price: 19.99,
          days: 14,
        },
      ],
    },
    Extras: {
      website: {
        price: 4.99,
      },
      youtube: {
        price: 4.99,
      },
      business: {
        price: 19.99,
      },
    },
  },
};
