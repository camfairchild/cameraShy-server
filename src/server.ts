"use strict";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { routes } from "./routes/routes";
import path from "path";
import fs from 'fs';
import { createServer } from "https";
import { Server, Socket } from "socket.io";

export const app = express();

const server = createServer({
  key: fs.readFileSync(process.env.KEY_PATH),
  cert: fs.readFileSync(process.env.CRT_PATH)
}, app);

const sio = new Server(server);

import mongoose from "mongoose";
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  server.listen(process.env.PORT || 3000);

  routes(app, sio);
  
  // catch 404 and forward to error handler
  app.use(function () {
    console.log('Error');
  });
});

module.exports = app;
