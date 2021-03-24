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
    const appleId: string = req.body.appleId;
    const numPlayers: number = req.body.numPlayers;
    const geofence = {
      lat: req.body.lat,
      long: req.body.long,
      bound: req.body["bound[]"],
      rad: req.body.rad
    };
    const timeLimit: number = req.body.time;
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
        res.status(200).json({ gameId: gameId });
        one_sig.sendOSnotif(
          host.osId,
          "Game Created!",
          "Join code: " + gameId,
          {}
        );
        console.log("GameId: " + gameId);
      }).catch((err) => {
        console.log(err);
        res.status(500).send({error: err.text});
      })
    } else {
      console.log("Error");
      res.status(404).json({error: "Host doesn't exist!"});
    }    
  });


router.route("/createUser")
  .post(upload.single("img"),
    function (req, res) {
      const name = req.body.name;
      const id = req.body.id;
      const file = req.file;
      const fileUrl = process.env.UPLOAD + file.filename;
      const osId = req.body.osId;
      db.createUser(name, id, fileUrl, osId)
        .then((result) => {
          console.log(result);
          res.status(200).send();
        })
        .catch((err) => {
          send_error(res, err);
        });
});

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

