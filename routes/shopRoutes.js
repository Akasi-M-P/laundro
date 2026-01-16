const express = require("express");

const shopController = require("../controllers/shopController");

const router = express.Router();

router
  .route("/")
  .post(shopController.createShop)
  .get(shopController.getAllShops);

router
  .route("/:id")
  .get(shopController.getShop)
  .patch(shopController.updateShop);

module.exports = router;
