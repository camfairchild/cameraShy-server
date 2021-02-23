"use strict";
require('dotenv').config()

var indexRouter = require("./routes/index");
var express = require("express");
var routes = require("./routes/routes");
var express = require("express");
var path = require("path");

var mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true});

var app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  
  routes(app, db);
  // catch 404 and forward to error handler
  app.use(function (req, res, next) {
    console.log('Error');
  });
  
  app.listen(process.env.PORT || 3000);
});
