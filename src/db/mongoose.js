const mongoose = require("mongoose");

console.log("Mongo URL:", process.env.MONGODB_URL);

mongoose.connect(process.env.MONGODB_URL)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));