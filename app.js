const express = require("express");

const shopRouter = require("./routes/shopRoutes");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// app.get("/", (req, res) => {
//   res.send("Hello World");
// });

app.use("/api/v1/shops", shopRouter);

module.exports = app;
