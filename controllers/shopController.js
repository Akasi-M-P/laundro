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
