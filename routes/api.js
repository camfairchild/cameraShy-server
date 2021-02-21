var express = require("express");
var router = express.Router();
var multer = require("multer");
var db = require("../db");
var path = require('path')
require('dotenv').config();
const fs = require('fs');
const axios = require("axios").default;

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname + '/../public/uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)) //Appending extension
  }
});


var upload = multer({ storage: storage });

router.route('/createGame')
  .post(async (req, res) => {
    var appleId = req.body.appleId;
    var numPlayers = req.body.numPlayers;
    var geofence = {
      lat: req.body.lat,
      long: req.body.long,
      bound: req.body["bound[]"],
      rad: req.body.rad
    };
    var timeLimit = req.body.time;
    console.log(req.body);
    console.log("Create game: " + appleId);
    var host = await db.getPlayerByAppleId(appleId);
    if (host) {
      db.createGame(
        host,
        geofence,
        numPlayers,
        timeLimit
      ).then((gameId) => {
        res.json({ gameId: gameId });
        header = "Game Created!";
        msg = "Join code: " + gameId;
        sendOSnotif(host.osId, header, msg, {});
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
      var name = req.body.name;
      var id = req.body.id;
      var file = req.file;
      var fileUrl = process.env.UPLOAD + file.filename;
      var osId = req.body.osId;
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

router.route('/shoot')
  .post(upload.single("img"),
    async function (req, res) {
      console.log(req.body);
      var appleId = req.body.id;
      console.log(appleId);
      var imgUrl = process.env.UPLOAD + req.file.filename;
      var loc = {lat: req.body.lat, long: req.body.long};
      var gameId = req.body.gameId;

      var shooter = await db.getPlayerByAppleId(appleId);
      var victim = await checkShot(gameId, imgUrl, loc);
      if (victim) {
        db.removePlayerFromGame(gameId, appleId);
        res.status(200).json({
          status: 1,
          message: "You eliminated " + victim.name
            + " from the game!"
        });
        var game = db.getGame(gameId);
        var numPlayers = game.players.length;
        //io.emit("player died", {numPlayers: numPlayers,
        //   shooter: shooter, victim: victim});
        notifyGame(game, victim.name + " was eliminated!",
          numPlayers + " players remain...",
         {numPlayers: numPlayers});
        sendOSnotif(victim.osId, "Oof... Eliminated!",
         "You were shot by " + shooter.name,
          {numPlayers: numPlayers});
      } else {
        res.json({ status: 0, message: "You missed! No player was found." });
      }
    });

function checkLoc(loc1, loc2) {
  var max_dist = process.env.MAX_DIST;
  var dist = getDistanceFromLatLonInKm(loc1.lat, loc1.long, loc2.lat, loc2.long);
  return dist <= max_dist;
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1);  // deg2rad below
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
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
    fnames = [];
    files.forEach(function (file) {
      // Do whatever you want to do with the file
      fnames.push("http://camera-shy.space/uploads/" + file);
    });
    return cb(fnames);
  });
};

router.route("/gallery")
.get(async (req, res) => {
  getGallery((files) => {
    res.json(files);
  });  
});

router.route('/loc')
  .post(async (req, res) => {
    var appleId = req.body.id;
    var loc = {lat: req.body.lat,
              long: req.body.long};
    var gameId = req.body.gameId;
    db.updateLoc(appleId, loc);
    var arr = await db.getLocs(gameId);
    console.log(arr);
    res.json(arr);
});

router.route('/cancel')
  .get(async (req, res) => {
    var appleId = req.query.AuthorizationappleId;
    var gameId = req.query.gameId;
    if (await db.gameExists(gameId)) {
      if (verifyHost(appleId, gameId)) {
        endGame(gameId);
        res.status(200);
      } else {
        console.log("Error");
        res.status(401).json({error: "You aren't the host!"});
      }
    } else {
      console.log("Error");
      res.status(404).json({error: "Game doesn't exist"});
    }    
  });

async function verifyHost(appleId, gameId) {
  var game = await db.getGame(gameId);
  return game.host.id == appleId;
};

router.route('/join')
  .get(async (req, res) => {
    var gameId = req.query.gameId;
    var appleId = req.query.appleId;
    console.log(req.query);
    if (await db.gameExists(gameId)) {
      db.joinGame(gameId, appleId)
      .then((game) => {
      console.log("THIS" + game);
      var num = game.players.length;
      res.status(200).json({game: game, numPlayers: num});
      }
      ).catch((err) => {
          console.log("Error");
          res.status(404).json({error: "Game doesn't exist"});
      }
      );            
    } else {
      console.log("Error");
      res.status(404).json({error: "Game doesn't exist"});
    }
});

async function checkShot(gameId, imgUrl, loc) {
  var personId = await db.identifyFace(imgUrl);
  if (personId) {
    var person = await db.getPlayerByPersonId(personId);
    // TODO
    if (db.getNumPlayers(gameId) == 1) {
      endGame(gameId);
    }
    db.addFace(personId, imgUrl);
    if (checkLoc(loc, person.lastCoords)) {
      return person;
    }
  }
  return null;
};

async function endGame(gameId) {
  var game = await db.getGame(gameId);
  if (game) {
    var numPlayers = game.players.length;
    io.emit("game over", {game_end: 1, numPlayers: numPlayers});
    notifyGame(game, "Game Over!", 
    "The game has ended. " + numPlayers + " players left!",
     {game_end: 1, numPlayers: numPlayers});
     db.removeGame(gameId);
  }
};

router.route("/leave")
  .get(async (req, res) => {
    var appleId = req.query.appleId;
    var gameId = req.query.gameId;
    console.log(req.query);
    if (await db.gameExists(gameId)) {
      db.removePlayerFromGame(gameId, appleId);
      console.log("Player: " + appleId + "left: " + gameId);
      res.status(200);
    } else {
      console.log("Error");
      res.status(404).json({error: "Game doesn't exist"});
    }    
  });

async function sendOSnotif(osId, header, content, data) {
  if (process.env.DEV) {
    return;
  }
  let endpoint = "https://onesignal.com/api/v1/notifications";
  var app_id = process.env.ONESIGNAL_APP;
  var os_key = process.env.ONESIGNAL_KEY;
  await axios({
    method: "post",
    url: endpoint,
    data: {
      app_id: app_id,
      include_player_ids: [osId],
      contents: { "en": content },
      headings: { "en": header },
      data: data
    },
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": "Basic " + os_key
    },
  })
    .then(function (response) {
      console.log("Status text: " + response.status);
      console.log("Status text: " + response.statusText);
      console.log();
      console.log(response.data);
    })
    .catch(function (error) {
      console.log(error);
    });
};

router.route("/avatar")
  .get((req, res) => {
    personID = req.query.appleId;
    imgUrl = db.getAvatar(personID);
    // TODO
    res.send(imgUrl);
  })

function send_error(res, error) {
  message = "There was an error: " + error;
  res.status(404)
    .type('text')
    .send(message);
}

router.route("/numPlayers")
  .get((req, res) => {
    gameID = req.query.gameID;
    try {
      numPlayers = db.getNumPlayers(gameID);
    } catch (err) {
      return res.status(500).send("Game ID doesn't exist!");
    }
    res.status(200).send(numPlayers);
  });

// Tests
router.route("/test_faceid")
  .post(upload.single('file'), async (req, res) => {
    var file = req.file;    
    var imgUrl = process.env.UPLOAD + file.filename;
    console.log(imgUrl);
    //await db.createUser("test", "test", imgUrl, "test");
    //await new Promise(r => setTimeout(r, 2000));
    id = await db.identifyFace(imgUrl);
    console.log(id);
    res.send(id);
  });

router.route("/test_notif")
  .post((req, res) => {
    console.log(req.body);
    var osId = req.body.osId;
    var msg = req.body.msg;
    var data = { status: 1, content: "sample data" };
    var header = req.body.header;
    sendOSnotif(osId, header, msg, data);
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

router.put("/start", (req, res) => {
  var gameId = req.body.gameId;
  var time = req.body.time;
  //io.emit('start game', {gameId: gameId, startTime: time});
});

async function notifyGame(game, title, msg, data) {
  for (i = 0; i < game.players.length; i++) {
    var osId = game.players[i].osId;
    sendOSnotif(osId, title, msg, data);
  }
}

module.exports = router;