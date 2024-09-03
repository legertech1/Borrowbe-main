const express = require("express");
const router = express();
const errors = require("../utils/errors.json");
const { Category, ruleDefaults } = require("../models/Category");
const { CategoryArchive } = require("../models/CategoryArchive");
const authorize = require("../utils/authorize");
const authorizeAdmin = require("../utils/authorizeAdmin");
const categoryUpdate = require("../utils/categoryUpdate");
const { adsPerReq } = require("../../serverConstants");

const updateArchive = (category, user) => {
  return new Promise(async (resolve, reject) => {
    try {
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
      resolve(archive);
    } catch (error) {
      reject(error);
    }
  });
};

const deleteArchive = (ids) => {
  return new Promise(async (resolve, reject) => {
    try {
      const archive = await CategoryArchive.findOneAndDelete({
        "current._id": { $in: ids },
      });
      resolve(archive);
    } catch (error) {
      reject(error);
    }
  });
};

router.put("/update-packages/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id },
      {
        "pricing.Basic": req.body.Basic,
        "pricing.Standard": req.body.Standard,
        "pricing.Premium": req.body.Premium,
      },
      { new: true }
    ).setOptions({
      user: req.user,
    });
    res.send(category);
    categoryUpdate(category);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({
      status: "active",
      subCategories: { $ne: [] },
    }).sort("num");

    const data = categories.map((category) => {
      return {
        ...category._doc,
        subCategories: category.subCategories.filter(
          (item) => item.status == "active"
        ),
      };
    });

    res.send(data);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.use(authorize);

router.get("/data", async (req, res) => {
  try {
    res.send(
      await Category.find({}).sort("num").setOptions({
        user: req.user,
      })
    );
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/archive", async (req, res) => {
  try {
    res.send(await CategoryArchive.find()).setOptions({
      user: req.user,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/change-category-order", async (req, res) => {
  try {
    const categories = await Category.find({}).setOptions({
      user: req.user,
    });
    const ids = req.body.categories;

    if (!ids) return res.status(400);
    for (let [ind, c] of categories.entries()) {
      if (c._id == ids[ind] && c.num == ind) continue;
      ids.forEach(async (id, ind) => {
        if (id == c._id && ind != c.num) {
          c.num = ind;
          await c.save();
        }
      });
    }

    res.send("ok");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/update-category-fields/:id", async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id }).setOptions({
      user: req.user,
    });
    if (!req.body.fields) return;
    await category.updateOne({ fields: req.body.fields });
    res.send("ok");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post(
  "/update-sub-category-fields/:category/:subCategory",
  async (req, res) => {
    try {
      const category = await Category.findOne({
        _id: req.params.category,
      }).setOptions({
        user: req.user,
      });
      if (!req.body.fields) return;
      await category.updateOne(
        { "subCategories.$[x].fields": req.body.fields },
        { new: true, arrayFilters: [{ "x._id": req.params.subCategory }] }
      );
      res.send("ok");
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.post("/change-sub-category-order/:id", async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id }).setOptions({
      user: req.user,
    });
    const ids = req.body.subCategories;
    if (!ids) return res.status(400);
    const subCategories = [];
    category.subCategories.forEach((c) => {
      ids.forEach((id, ind) => {
        if (c._id == id) subCategories[ind] = c;
      });
    });
    if (subCategories.length != category.subCategories.length)
      return res.status(400).send("An error occurred");
    category.subCategories = subCategories;
    await category.save();
    res.send("ok");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/make-category", async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/make-sub-category/:id", async (req, res) => {
  try {
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
    ).setOptions({
      user: req.user,
    });
    await updateArchive(category, req.user);

    res.send(category);
    categoryUpdate(category);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/make-category-field/:id", async (req, res) => {
  try {
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
    ).setOptions({
      user: req.user,
    });
    await updateArchive(category, req.user);
    res.send(category);
    categoryUpdate(category);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/delete-category-fields/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id },
      {
        $pullAll: {
          fields: req.body.fields,
        },
        updatedAt: new Date(),
      },
      { new: true }
    ).setOptions({
      user: req.user,
    });
    await updateArchive(category, req.user);
    res.send({ info: "acknowledged" });
    categoryUpdate(category);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/make-sub-category-field/:id", async (req, res) => {
  try {
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
    ).setOptions({
      user: req.user,
    });

    await updateArchive(category, req.user);
    res.send(category);
    categoryUpdate(category);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
router.post("/delete-sub-category-fields/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { "subCategories._id": req.params.id },
      {
        $pullAll: {
          "subCategories.$[x].fields": req.body.fields,
        },
        updatedAt: new Date(),
      },
      { new: true, arrayFilters: [{ "x._id": req.params.id }] }
    ).setOptions({
      user: req.user,
    });
    await updateArchive(category, req.user);
    res.send({ info: "acknowledged" });
    categoryUpdate(category);
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/delete-categories", async (req, res) => {
  try {
    const ids = req.body.ids;
    const deleted = await Category.deleteMany({ _id: { $in: ids } }).setOptions(
      {
        user: req.user,
      }
    );
    await deleteArchive(ids);
    res.send({ info: "acknowledged" });
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/activate-categories", async (req, res) => {
  try {
    const ids = req.body.ids;
    const updated = await Category.updateMany(
      { _id: { $in: ids } },
      { status: "active" }
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/deactivate-categories", async (req, res) => {
  try {
    const ids = req.body.ids;
    const updated = await Category.updateMany(
      { _id: { $in: ids } },
      { status: "inactive" }
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/delete-sub-categories", async (req, res) => {
  try {
    const ids = req.body.ids;
    const categories = await Category.updateMany(
      { "subCategories._id": { $in: ids } },
      {
        $pull: {
          subCategories: { _id: { $in: ids } },
        },
      }
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/deactivate-sub-categories/:id", async (req, res) => {
  try {
    const ids = req.body.ids;
    const categories = await Category.updateMany(
      { _id: req.params.id },
      { $set: { "subCategories.$[x].status": "inactive" } },
      {
        multi: true,
        arrayFilters: [{ "x._id": { $in: ids } }],
      }
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/activate-sub-categories/:id", async (req, res) => {
  try {
    const ids = req.body.ids;
    const categories = await Category.updateMany(
      { _id: req.params.id },
      { $set: { "subCategories.$[x].status": "active" } },
      {
        multi: true,
        arrayFilters: [{ "x._id": { $in: ids } }],
      }
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/update-category/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id },
      req.body,
      { new: true }
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
    categoryUpdate(category);
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/update-sub-category/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { "subCategories._id": req.params.id },
      { $set: { "subCategories.$[x]": req.body } },
      {
        multi: true,
        arrayFilters: [{ "x._id": req.params.id }],
        new: true,
      }
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
    categoryUpdate(category);
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/update-category-rules/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id },
      { rules: req.body },
      { new: true }
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
    categoryUpdate(category);
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/update-sub-category-rules/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { "subCategories._id": req.params.id },
      { $set: { "subCategories.$[x].rules": req.body } },
      {
        multi: true,
        arrayFilters: [{ "x._id": req.params.id }],
        new: true,
      }
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
    categoryUpdate(category);
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/revert-sub-category-rules/:id", async (req, res) => {
  try {
    if (req?.body?.rules) {
      const category = await Category.findOneAndUpdate(
        { "subCategories._id": req.params.id },
        { "subCategories.$[x].rules": req.body.rules },
        {
          arrayFilters: [{ "x._id": req.params.id }],
          new: true,
        }
      ).setOptions({
        user: req.user,
      });
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
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
    categoryUpdate(category);
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/change-category-field-order/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id },
      { fields: req.body.fields },
      { new: true }
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
    categoryUpdate(category);
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.post("/change-sub-category-field-order/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { "subCategories._id": req.params.id },
      { "subCategories.$[x].fields": req.body.fields },
      {
        arrayFilters: [{ "x._id": req.params.id }],
        new: true,
      }
    ).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
    categoryUpdate(category);
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});
router.put("/update-add-ons/:id", async (req, res) => {
  try {
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
    ).setOptions({
      user: req.user,
    });
    res.send(category);
    categoryUpdate(category);
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

router.put("/update-extras/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id },
      {
        "pricing.Extras": req.body,
      }
    ).setOptions({
      user: req.user,
    });
    res.send(category);
    categoryUpdate(category);
  } catch (error) {
    res.status(500).send({ error: "An error occurred" });
  }
});

const isValidObjectId = (id) => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
};

module.exports = router;
