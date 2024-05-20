module.exports = function (category, payment, ad) {
  return {
    status: "active",
    duration: category.rules.adDuration,
    initialised: Date.now(),
    listingRank: Date.now(),
    highlighted:
      payment.cart.package.item.highlighted || payment.cart.addOns.highlighted
        ? true
        : false,
    featured:
      payment.cart.package.item.featured || payment.cart.addOns.featured
        ? true
        : false,
    homepageGallery:
      payment.cart.package.item.homepageGallery ||
      payment.cart.addOns.homepageGallery
        ? true
        : false,
    category: payment.cart.category,
    subCategory: ad.subCategory,
    business: payment.cart.extras.business ? true : false,
    country: payment.country,
  };
};
