const express = require("express");

const router = new express.Router();

router.get("/ping", (req, res) => {
  res.sendFile(__dirname + "/documents/ping.mp3");
});
router.get("/:name", (req, res) => {
  const { name } = req.params;
  res.sendFile(__dirname + "/documents/" + name + ".html");
});
module.exports = router;
