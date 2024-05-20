const { Category } = require("../models/Category");
const errors = require("./errors.json");

module.exports = async function (pricing, name, user, ignoreFree) {
  let total = 0;
  let cart = {};
  if (!pricing.package || !pricing.package.item || !pricing.package.name)
    throw new Error(errors["invalid-cart-data"]);

  const category = await Category.findOne({ name });
  if (!category) throw new Error(errors["invalid-category-payment"]);
  cart.category = category.name;
  if (
    !ignoreFree &&
    (user?.data?.postedAds[name]?.free || 0) <
      category.pricing[pricing.package.name].freeAds
  ) {
    total += 0;
    cart.package = {
      name: pricing.package.name,
      item: category.pricing[pricing.package.name],
      free: true,
    };
  } else {
    total += category.pricing[pricing.package.name].price;
    cart.package = {
      name: pricing.package.name,
      item: category.pricing[pricing.package.name],
    };
  }

  if (pricing.addOns) {
    for (let addOn of Object.keys(pricing.addOns)) {
      if (!pricing.addOns[addOn] || !category.pricing.AddOns[addOn]) continue;

      let item = category.pricing.AddOns[addOn].filter((i) => {
        if (
          i.price == pricing.addOns[addOn].price &&
          ((i.days && i.days == pricing.addOns[addOn].days) ||
            (i.frequency && i.frequency == pricing.addOns[addOn].frequency))
        )
          return true;
        else return false;
      })[0];

      if (!item) throw new Error(errors["invalid-cart-data"]);
      cart.addOns = {
        ...cart.addOns,
        [addOn]: item,
      };
      total += item.price;
    }
  }
  if (pricing.extras) {
    for (let extra of Object.keys(pricing.extras)) {
      if (!pricing.extras[extra]) continue;
      if (!category.pricing.Extras[extra])
        throw new Error(errors["invalid-cart-data"]);
      total += category.pricing.Extras[extra].price;
      cart.extras = {
        ...cart.extras,
        [extra]: {
          ...category.pricing.Extras[extra]._doc,
          url: pricing?.extras[extra]?.url,
        },
      };
    }
  }

  return [total.toFixed(2), cart];
};
