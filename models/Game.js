var mongoose = require("mongoose");

var GameSchema = new mongoose.Schema({
  id: String,
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lat: Number,
  long: Number,
  rad: Number,
  bound: [Number],
  timeLimit: Number,
  memberLimit: Number,
  players: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
});


module.exports = mongoose.model("Game", GameSchema);