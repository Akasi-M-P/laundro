const app = require("./app");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB)
  .then(() => console.log("DB connected Successfully"))
  .catch((err) => console.log(err));

const port = process.env.PORT;

const server = app.listen(port, () => {
  console.log(`Hello from my server listening on port ${port}`);
});
