var mongoose = require("mongoose");

var UserSchema = new mongoose.Schema({
  id: String,
  osId: String,
  personId: String,
  name: String,
  lastCoords: {
    lat: Number,
    long: Number,
  },
  imageUrl: String
});

module.exports = mongoose.model("User", UserSchema);