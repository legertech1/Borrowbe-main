const express = require("express");
const authRouter = require("./auth");
const managementRouter = require("./management");
const authorize = require("../utils/authorize");
const userRouter = require("./users");
const locationRouter = require("./location");
const adRouter = require("./ads");
const categoryRouter = require("./categoryManagement");
const paymentRouter = require("./payments");
const router = new express.Router();
const documentRouter = require("./documents");
const dashboardRouter = require("./dashboard");

//open routes
router.use("/auth", authRouter);
router.use("/documents", documentRouter);
// sub authorized routes
router.use("/ads", adRouter);
router.use("/location", locationRouter);
router.use("/users", userRouter);
router.use("/payment", paymentRouter);

//sub authorized admin routes
router.use("/categories", categoryRouter);
router.use("/manage", managementRouter);
//authorized routes
router.use(authorize);
router.use("/dashboard", dashboardRouter);

//admin routes , only acessablefor admins

module.exports = router;
