import dotenv from "dotenv";
dotenv.config();

import express from "express";
export const router = express.Router();
import multer from "multer";
import * as db from "../db";
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import * as one_sig from "../one_signal";

interface MulterRequest extends Request {
  file: any;
}

interface ShootRequest {
  id: string,
  lat: number,
  long: number,
  gameId: string
}

interface Coord {
  lat: number,
  long: number
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname + '/../public/uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)) //Appending extension
  }
});


const upload = multer({ storage: storage });

router.route('/createGame')
  .post(async (req, res) => {
    const appleId = req.body.appleId;
    const numPlayers = req.body.numPlayers;
    const geofence = {
      lat: req.body.lat,
      long: req.body.long,
      bound: req.body["bound[]"],
      rad: req.body.rad
    };
    const timeLimit = req.body.time;
    console.log(req.body);
    console.log("Create game: " + appleId);
    const host = await db.getPlayerByAppleId(appleId);
    if (host) {
      db.createGame(
        host,
        geofence,
        numPlayers,
        timeLimit
      ).then((gameId) => {
        res.json({ gameId: gameId });
        one_sig.sendOSnotif(
          host.osId,
          "Game Created!",
          "Join code: " + gameId,
          {}
        );
        console.log("GameId: " + gameId);
      }).catch((err) => {
        console.log(err);
        res.send(err.text);
      })
    } else {
      console.log("Error");
      res.status(404).json({error: "Host doesn't exist!"});
    }    
  });


router.route("/createUser")
  .post(upload.single("img"),
    async function (req, res) {
      const name = req.body.name;
      const id = req.body.id;
      const file = req.file;
      const fileUrl = process.env.UPLOAD + file.filename;
      const osId = req.body.osId;
      await db
        .createUser(name, id, fileUrl, osId)
        .then((result) => {
          console.log(result);
          res.status(200).send();
        })
        .catch((err) => {
          send_error(res, err);
        });
});

// TODO: Make this a socket
router.route('/shoot')
  .post(upload.single("img"),
    async function (req, res) {
      console.log(req.body);
      const body = req.body as ShootRequest;
      const appleId = body.id;
      console.log(appleId);
      const imgUrl = process.env.UPLOAD + req.file.filename;
      const loc = {lat: body.lat, long: body.long};
      const gameId = body.gameId;

      const shooter = await db.getPlayerByAppleId(appleId);
      const victim = await checkShot(gameId, imgUrl, loc);
      if (victim !== null) {
        db.removePlayerFromGame(gameId, appleId);
        res.status(200).json({
          status: 1,
          message: "You eliminated " + victim.name
            + " from the game!"
        });
        const game = await db.getGame(gameId);
        const numPlayers = game.players.length;
        //io.emit("player died", {numPlayers: numPlayers,
        //   shooter: shooter, victim: victim});
        notifyGame(game, victim.name + " was eliminated!",
          numPlayers + " players remain...",
         {numPlayers: numPlayers});
        one_sig.sendOSnotif(victim.osId, "Oof... Eliminated!",
         "You were shot by " + shooter.name,
          {numPlayers: numPlayers});
      } else {
        res.json({ status: 0, message: "You missed! No player was found." });
      }
    });

function checkLoc(loc1: Coord, loc2) {
  const max_dist: number = parseFloat(process.env.MAX_DIST);
  const dist = getDistanceFromLatLonInKm(loc1.lat, loc1.long, loc2.lat, loc2.long);
  return dist <= max_dist;
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);  // deg2rad below
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
    ;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180)
}

async function getGallery(cb) {
  const directoryPath = path.join(__dirname, '../public/uploads');
  return fs.readdir(directoryPath, function (err, files) {
    //handling error
    if (err) {
      return console.log('Unable to scan directory: ' + err);
    }
    //listing all files using forEach
    const fnames = [];
    files.forEach(function (file) {
      // Do whatever you want to do with the file
      fnames.push("http://camera-shy.space/uploads/" + file);
    });
    return cb(fnames);
  });
}

router.route("/gallery")
.get(async (req, res) => {
  getGallery((files) => {
    res.json(files);
  });  
});

// TODO: Make this a socket 
router.route('/loc')
  .post(async (req, res) => {
    const appleId = req.body.id;
    const loc = {lat: req.body.lat,
              long: req.body.long};
    const gameId = req.body.gameId;
    db.updateLoc(appleId, loc);
    const arr = await db.getLocs(gameId);
    console.log(arr);
    res.json(arr);
});

// TODO: Make this a socket
async function checkShot(gameId, imgUrl, loc) {
  const personId = await db.identifyFace(imgUrl);
  console.log(personId);
  if (personId) {
    const person = await db.getPlayerByPersonId(personId);
    console.log(person);
    if (await db.getNumPlayers(gameId) == 1) {
      endGame(gameId);
    }
    db.addFace(personId, imgUrl);
    if (checkLoc(loc, person.lastCoords)) {
      return person;
    }
  }
  return null;
}

router.route("/avatar")
  .get(async (req, res) => {
    const personID: string = req.query.appleId as string;
    const imgUrl: string = await db.getAvatar(personID);
    // TODO: not sure why this is here
    res.send(imgUrl);
  })

function send_error(res, error) {
  const message = "There was an error: " + error;
  res.status(404)
    .type('text')
    .send(message);
}

router.route("/numPlayers")
  .get(async (req, res) => {
    const gameId: string = req.query.gameID as string;
    let numPlayers: number;
    try {
      numPlayers = await db.getNumPlayers(gameId);
    } catch (err) {
      return res.status(500).send("Game ID doesn't exist!");
    }
    res.status(200).send(numPlayers);
  });

// Tests
router.route("/test_faceid")
  .post(upload.single('file'), async (req, res) => {
    const file = req.file;    
    const imgUrl = process.env.UPLOAD + file.filename;
    console.log(imgUrl);
    //await db.createUser("test", "test", imgUrl, "test");
    //await new Promise(r => setTimeout(r, 2000));
    const id = await db.identifyFace(imgUrl);
    console.log(id);
    res.send(id);
  });

router.route("/test_notif")
  .post((req, res) => {
    console.log(req.body);
    const osId = req.body.osId;
    const msg = req.body.msg;
    const data = { status: 1, content: "sample data" };
    const header = req.body.header;
    one_sig.sendOSnotif(osId, header, msg, data);
    console.log("Sent Notif!\n" + osId + "\n"
      + header + ": " + msg);
    res.redirect("../");
  });

router.route("/init").get((req, res) => {
  console.log("started");
  db.init();
  res.end();
});

router.route("/clear").get((req, res) => {
  db.clear();
});

