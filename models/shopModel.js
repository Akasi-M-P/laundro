const mongoose = require("mongoose");
const validator = require("validator");

const shopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide the name of your shop"],
    },
    shopId: String,
    email: {
      type: String,
      required: [true, "Please provide your shop email address"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email address"],
    },
    phoneNumber: {
      type: Number,
      required: [true, "Please provide phone number"],
      unique: true,
      validate: [
        validator.isMobilePhone,
        "Please provide a valid phone number",
      ],
    },
    location: String,
    createdAt: { type: Date, default: Date.now(), select: false },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Shop = mongoose.model("Shop", shopSchema);

module.exports = Shop;
