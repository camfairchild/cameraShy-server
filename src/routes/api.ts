import dotenv from "dotenv";
dotenv.config();

import express from "express";
export const router = express.Router();
import multer from "multer";
import * as db from "../db";
import path from "path";
import fs from "fs";
import axios from "axios";
import * as one_sig from "../one_signal";
import { OAuth2Client } from 'google-auth-library';

import {checkAuth, issueJwt} from "../middleware/auth";

interface MulterRequest extends Request {
  file: any;
}

interface ShootRequest {
  id: string;
  lat: number;
  long: number;
  gameId: string;
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname + "../../../public/uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); //Appending extension
  },
});

const upload = multer({ storage: storage });

router.route("/createGame").post(checkAuth, async (req, res) => {
  const appleId: string = req.body.appleId;
  const numPlayers: number = req.body.numPlayers;
  const geofence = {
    lat: req.body.lat,
    long: req.body.long,
    bound: req.body["bound[]"],
    rad: req.body.rad,
  };
  const timeLimit: number = req.body.time;
  console.log(req.body);
  console.log("Create game: " + appleId);
  const host = await db.getPlayerByAppleId(appleId);
  if (host) {
    db.createGame(host, geofence, numPlayers, timeLimit)
      .then((gameId) => {
        res.status(200).json({ gameId: gameId });
        one_sig.sendOSnotif(
          host.osId,
          "Game Created!",
          "Join code: " + gameId,
          {}
        );
        console.log("GameId: " + gameId);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send({ error: err.text });
      });
  } else {
    console.log("Error");
    res.status(404).json({ error: "Host doesn't exist!" });
  }
});

async function getGallery(cb) {
  const directoryPath = path.join(__dirname, "../public/uploads");
  return fs.readdir(directoryPath, function (err, files) {
    //handling error
    if (err) {
      console.log("Unable to scan directory: " + err);
      throw err;
    }
    //listing all files using forEach
    const fnames = [];
    files.forEach(function (file) {
      // Do whatever you want to do with the file
      fnames.push("/uploads/" + file);
    });
    return cb(fnames);
  });
}

router.route("/gallery").get(checkAuth, async (req, res) => {
  getGallery((files) => {
    res.status(200).json(files);
  }).catch((err) => {
    send_error(res, err, 500);
  });
});

router.route("/avatar").get(async (req, res) => {
  const _id: string = req.query.userId as string;
  db.getAvatar(_id)
    .then((imgUrl: string) => {
      if (imgUrl != null) {
        res.status(200).json({
          avatarUrl: imgUrl,
        });
      } else {
        send_error(res, `User with userId ${_id} does not exist`, 404);
      }
    })
    .catch((err) => {
      send_error(res, err, 500);
    });
});

function send_error(res, error, status_code: number) {
  res.status(status_code).json({ error: error });
}

router.route("/numPlayers").get(checkAuth, async (req, res) => {
  try {
    const gameId: string = req.query.gameId as string;
    const numPlayers = await db.getNumPlayers(gameId);
    const numPlayersAlive = await db.getNumPlayersAlive(gameId);
    if (numPlayers != null && numPlayersAlive != null) {
      res.status(200).json({
        numPlayers,
        numPlayersAlive,
      });
    } else {
      send_error(res, `Game with gameId ${gameId} does not exist`, 404);
    }
  } catch (err) {
    send_error(res, err, 500);
  }
});

router.route("/clear").get((req, res) => {
  db.clear();
});

router
  .route("/test_faceid")
  .post(upload.single("file"), async function (req, res) {
    const file = req.file;
    const fileUrl = process.env.UPLOAD + file.filename;
    const gameId = req.body.gameId;
    res.status(200).json(await db.identifyFace(fileUrl, gameId));
  });

router
  .route('/login')
  .post(async function (req, res) {
    const { appleId, google_idToken } = req.body;
    let googleId = null;
    let player = null;
    if (google_idToken) {
      // google auth
      try {
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
            idToken: google_idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        googleId = payload['sub'];

        player = await db.getPlayerByGoogleId(googleId);
      } catch (err) {
        // error with google authentication
        console.error(err);
        send_error(res, "Google authentication error; Please retry.", 500);
      }
      if (player) {
        res.status(200).json({
          player: player,
        });
      }
    } else if (appleId) {
      // apple auth
      player = await db.getPlayerByAppleId(appleId);
      if (player) {
        res.status(200).json({
          player,
        });
      }
    } else {
      send_error(res, 'Please login with appleId or google_idToken', 400);
    }

    if (player === null) {
      // register new user
      player = await db.createUser(
        null, appleId, googleId, null, null
      );
      // new user created
      res.status(201)
    } else {
      // user already exists
      res.status(200)
    }
    const token = await issueJwt(player._id)
    res.json({
      token,
      user: {
        userId: player._id,
        name: player.name,
        socketId: player.socketId,
        email: player.email,
        imageUrl: player.imageUrl,
      }
    });
  });

router
  .route('/profile/edit')
  .put(async function (req, res) {
    const { userId } = req.body;
    const { name, email, imageUrl } = req.body;
    const player = await db.getPlayerById(userId);
    if (!player) {
      // user doesn't exist
      return send_error(res, `User with userId ${userId} does not exist`, 404);
    }

    const result = await db.editProfile(userId, name, email, imageUrl)
    if (result) {
      res.status(200).json({
        player: result,
      });
    } else {
      send_error(res, "Error editing profile", 500);
    }
  });
