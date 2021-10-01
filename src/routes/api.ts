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
    cb(null, path.join(__dirname + '../../../public/uploads'));
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
          res.sendStatus(200);
        })
        .catch((err) => {
          send_error(res, err, 500);
        });
});

async function getGallery(cb) {
  const directoryPath = path.join(__dirname, '../public/uploads');
  return fs.readdir(directoryPath, function (err, files) {
    //handling error
    if (err) {
      console.log('Unable to scan directory: ' + err);
      throw err
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

router.route("/gallery")
.get(async (req, res) => {
  getGallery((files) => {
    res.status(200).json(files);
  }).catch((err) => {
    send_error(res, err, 500);
  })
  });  

router.route("/avatar")
  .get(async (req, res) => {
    const appleId: string = req.query.appleId as string;
    db.getAvatar(appleId).then((imgUrl: string) => {
      if (imgUrl != null) {
        res.status(200).json({
          avatarUrl: imgUrl
        });
      } else {
        send_error(res,
           `User with appleId ${appleId} does not exist`,
            404);
      }
  })
    .catch((err) => {
      send_error(res, err, 500);
    });
  })

function send_error(res, error, status_code: number) {
  res.status(status_code)
    .json({error: error});
}

router.route("/numPlayers")
  .get(async (req, res) => {
    const gameId: string = req.query.gameId as string;
    db.getNumPlayers(gameId)
    .then((num) => {
      if (num != null) {
        res.status(200)
          .json({
            numPlayers: num
          });
      } else {
        send_error(res,
          `Game with gameId ${gameId} does not exist`,
           404);
    }
    })
    .catch((err) => {
      send_error(res, err, 500);
    })
  });

router.route("/init").get((req, res) => {
  console.log("started");
  db.init();
  res.end();
});

router.route("/clear").get((req, res) => {
  db.clear();
});

router.route("/test_faceid").post(upload.single("file"),
async function (req, res) {
  const file = req.file;
  const fileUrl = process.env.UPLOAD + file.filename;
  res.status(200).json(await db.identifyFace(fileUrl));
});
