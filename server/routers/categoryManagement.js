const express = require("express");
const router = express();
const errors = require("../utils/errors.json");
const { Category, ruleDefaults } = require("../models/Category");
const { CategoryArchive } = require("../models/CategoryArchive");
const authorize = require("../utils/authorize");
const authorizeAdmin = require("../utils/authorizeAdmin");
const categoryUpdate = require("../utils/categoryUpdate");

const updateArchive = (category, user) => {
  return new Promise(async (resolve, reject) => {
    const archive = await CategoryArchive.findOneAndUpdate(
      { name: category.name },
      {
        current: category,
        $push: {
          archive: {
            data: category,
            user: {
              name: user.firstName + " " + user.lasName,
              id: user._id,
            },
          },
        },
      },
      { new: true }
    );
    return resolve(archive);
  });
};
const deleteArchive = (ids) => {
  return new Promise(async (resolve, reject) => {
    const archive = await CategoryArchive.findOneAndDelete({
      "current._id": { $in: ids },
    });
    return resolve(archive);
  });
};

router.put("/update-packages/:id", async (req, res) => {
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id },
    {
      "pricing.Basic": req.body.Basic,
      "pricing.Standard": req.body.Standard,
      "pricing.Premium": req.body.Premium,
    },
    { new: true }
  );
  res.send(category);
  categoryUpdate(category);
});

router.get("/", async (req, res) => {

  const categories = await Category.find({
    status: "active",
    subCategories: { $ne: [] },
  });

  const data = categories.map((category) => {
    return {
      ...category._doc,
      subCategories: category.subCategories.filter(
        (item) => item.status == "active"
      ),
    };
  });

  res.send(data);
});

router.use(authorize);
router.use(authorizeAdmin);
router.get("/data", async (req, res) => {
  res.send(await Category.find({}));
});

router.get("/archive", async (req, res) => {
  res.send(await CategoryArchive.find());
});

router.post("/make-category", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send({ error: errors["bad-request"] });
  const category = new Category({
    ...req.body,
    active: false,
  });

  await category.save();
  const archive = new CategoryArchive({
    name,
    current: category,
    archive: [
      {
        data: category,
        user: {
          name: req.user.firstName + " " + req.user.lastName,
          id: req.user._id,
        },
      },
    ],
  });
  await archive.save();
  res.send(category);
  // categoryUpdate(category)
});

router.post("/make-sub-category/:id", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send({ error: errors["bad-request"] });
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id },
    {
      $push: {
        subCategories: { ...req.body },
      },
      udpatedAt: new Date(),
    },
    { new: true }
  );
  await updateArchive(category, req.user);

  res.send(category);
  categoryUpdate(category);
});

router.post("/make-category-field/:id", async (req, res) => {
  const { name, inputType } = req.body;
  if (!name || !inputType)
    return res.status(400).send({ error: errors["bad-request"] });
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id },
    {
      $push: {
        fields: { ...req.body },
      },
      updatedAt: new Date(),
    },
    { new: true }
  );
  await updateArchive(category, req.user);
  res.send(category);
  categoryUpdate(category);
});

router.post("/delete-category-fields/:id", async (req, res) => {
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id },
    {
      $pullAll: {
        fields: req.body.fields,
      },
      updatedAt: new Date(),
    },
    { new: true }
  );
  await updateArchive(category, req.user);
  res.send({ info: "acknowledged" });
  categoryUpdate(category);
});

router.post("/make-sub-category-field/:id", async (req, res) => {
  const { name, inputType } = req.body;
  if (!name || !inputType)
    return res.status(400).send({ error: errors["bad-request"] });
  const category = await Category.findOneAndUpdate(
    { "subCategories._id": req.params.id },
    {
      $push: {
        "subCategories.$.fields": { ...req.body },
      },
      updatedAt: new Date(),
    },
    { new: true }
  );

  await updateArchive(category, req.user);
  res.send(category);
  categoryUpdate(category);
});
router.post("/delete-sub-category-fields/:id", async (req, res) => {
  const category = await Category.findOneAndUpdate(
    { "subCategories._id": req.params.id },
    {
      $pullAll: {
        "subCategories.$[x].fields": req.body.fields,
      },
      updatedAt: new Date(),
    },
    { new: true, arrayFilters: [{ "x._id": req.params.id }] }
  );
  await updateArchive(category, req.user);
  res.send({ info: "acknowledged" });
  categoryUpdate(category);
});

router.post("/delete-categories", async (req, res) => {
  const ids = req.body.ids;

  const deleted = await Category.deleteMany({ _id: { $in: ids } });
  await deleteArchive(ids);
  res.send({ info: "acknowledged" });
  // categoryUpdate(category)
});

router.post("/activate-categories", async (req, res) => {
  const ids = req.body.ids;
  const updated = await Category.updateMany(
    { _id: { $in: ids } },
    { status: "active" }
  );
  res.send({ info: "acknowledged" });
  // categoryUpdate(category)
});

router.post("/deactivate-categories", async (req, res) => {
  const ids = req.body.ids;
  const updated = await Category.updateMany(
    { _id: { $in: ids } },
    { status: "inactive" }
  );
  res.send({ info: "acknowledged" });
  // categoryUpdate(category)
});

router.post("/delete-sub-categories", async (req, res) => {
  const ids = req.body.ids;
  const categories = await Category.updateMany(
    { "subCategories._id": { $in: ids } },
    {
      $pull: {
        subCategories: { _id: { $in: ids } },
      },
    }
  );
  res.send({ info: "acknowledged" });
});

router.post("/deactivate-sub-categories/:id", async (req, res) => {
  const ids = req.body.ids;
  const categories = await Category.updateMany(
    { _id: req.params.id },
    { $set: { "subCategories.$[x].status": "inactive" } },
    {
      multi: true,
      arrayFilters: [{ "x._id": { $in: ids } }],
    }
  );
  res.send({ info: "acknowledged" });
});
module.exports = router;

router.post("/activate-sub-categories/:id", async (req, res) => {
  const ids = req.body.ids;
  const categories = await Category.updateMany(
    { _id: req.params.id },
    { $set: { "subCategories.$[x].status": "active" } },
    {
      multi: true,
      arrayFilters: [{ "x._id": { $in: ids } }],
    }
  );
  res.send({ info: "acknowledged" });
});

router.post("/update-category/:id", async (req, res) => {
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id },
    req.body,
    { new: true }
  );
  res.send({ info: "acknowledged" });
  categoryUpdate(category);
});

router.post("/update-sub-category/:id", async (req, res) => {
  const category = await Category.findOneAndUpdate(
    { "subCategories._id": req.params.id },
    { $set: { "subCategories.$[x]": req.body } },
    {
      multi: true,
      arrayFilters: [{ "x._id": req.params.id }],
      new: true,
    }
  );
  res.send({ info: "acknowledged" });
  categoryUpdate(category);
});

router.post("/update-category-rules/:id", async (req, res) => {
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id },
    { rules: req.body },
    { new: true }
  );
  res.send({ info: "acknowledged" });
  categoryUpdate(category);
});
router.post("/update-sub-category-rules/:id", async (req, res) => {
  const category = await Category.findOneAndUpdate(
    { "subCategories._id": req.params.id },
    { $set: { "subCategories.$[x].rules": req.body } },
    {
      multi: true,
      arrayFilters: [{ "x._id": req.params.id }],
      new: true,
    }
  );
  res.send({ info: "acknowledged" });
  categoryUpdate(category);
});

router.post("/revert-sub-category-rules/:id", async (req, res) => {
  if (req?.body?.rules) {
    const category = await Category.findOneAndUpdate(
      { "subCategories._id": req.params.id },
      { "subCategories.$[x].rules": req.body.rules },
      {
        arrayFilters: [{ "x._id": req.params.id }],
        new: true,
      }
    );
    categoryUpdate(category);
    return res.send({ info: "acknowledged" });
  }
  const category = await Category.findOneAndUpdate(
    { "subCategories._id": req.params.id },
    { $unset: { "subCategories.$[x].rules": [Object.keys(ruleDefaults)] } },
    {
      arrayFilters: [{ "x._id": req.params.id }],
      new: true,
    }
  );
  res.send({ info: "acknowledged" });
  categoryUpdate(category);
});

router.post("/change-category-field-order/:id", async (req, res) => {
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id },
    { fields: req.body.fields },
    { new: true }
  );
  res.send({ info: "acknowledged" });
  categoryUpdate(category);
});

router.post("/change-sub-category-field-order/:id", async (req, res) => {
  const category = await Category.findOneAndUpdate(
    { "subCategories._id": req.params.id },
    { "subCategories.$[x].fields": req.body.fields },
    {
      arrayFilters: [{ "x._id": req.params.id }],
      new: true,
    }
  );
  res.send({ info: "acknowledged" });
  categoryUpdate(category);
});

router.put("/update-add-ons/:id", async (req, res) => {
  req.body.bumpUp.forEach((i) => {
    if (isValidObjectId(i._id)) delete i._id;
  });
  req.body.featured.forEach((i) => {
    if (isValidObjectId(i._id)) delete i._id;
  });
  req.body.homepageGallery.forEach((i) => {
    if (isValidObjectId(i._id)) delete i._id;
  });
  req.body.highlighted.forEach((i) => {
    if (isValidObjectId(i._id)) delete i._id;
  });

  const category = await Category.findOneAndUpdate(
    { _id: req.params.id },
    {
      "pricing.AddOns.bumpUp": req.body.bumpUp,
      "pricing.AddOns.featured": req.body.featured,
      "pricing.AddOns.homepageGallery": req.body.homepageGallery,
      "pricing.AddOns.highlighted": req.body.highlighted,
    }
  );
  res.send(category);
  categoryUpdate(category);
});
router.put("/update-extras/:id", async (req, res) => {
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id },
    {
      "pricing.Extras": req.body,
    }
  );
  res.send(category);
  categoryUpdate(category);
});

const isValidObjectId = (id) => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
};

module.exports = router;
