const express = require("express");

const shopController = require("../controllers/shopController");

const router = express.Router();

router.route("/").post(shopController.createShop);

module.exports = router;
