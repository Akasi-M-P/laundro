const express = require("express");

const shopRouter = require("./routes/shopRoutes");

const app = express();

// for API requests sending JSON
app.use(express.json());
// for traditional HTML form submissions
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1/shops", shopRouter);

module.exports = app;
