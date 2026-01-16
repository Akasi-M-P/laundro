const express = require("express");

const shopRouter = require("./routes/shopRoutes");

const app = express();

// app.get("/", (req, res) => {
//   res.send("Hello World");
// });

app.use("/api/v1/shops", shopRouter);

module.exports = app;
