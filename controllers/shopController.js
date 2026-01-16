const Shop = require("../models/shopModel");

exports.createShop = async (req, res) => {
  try {
    const shop = await Shop.create(req.body);
    res.status(200).json({
      status: "succeess",
      data: {
        data: shop,
      },
    });
  } catch (error) {
    res.status(404).json({
      status: error.message,
      error,
    });
  }

  console.log("CREATE SHOP TRIGGERED");
};

exports.getAllShops = async (req, res) => {
  try {
    const shops = await Shop.find();

    res.status(200).json({
      status: "success",
      data: {
        data: shops,
      },
    });
  } catch (error) {
    res.status(404).json({
      status: error.message,
      error,
    });
  }
};

exports.getShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);

    res.status(200).json({
      status: "success",
      data: shop,
    });
  } catch (error) {
    res.status(404).json({
      status: error.message,
      error,
    });
  }
};

exports.updateShop = async (req, res) => {
  try {
    const shop = await Shop.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      status: "success",
      data: shop,
    });
  } catch (error) {
    res.status(404).json({
      status: error.message,
      error,
    });
  }
};
