"use strict";
require("dotenv").config();
var Game = require("./models/Game");
var User = require("./models/User");
const axios = require("axios").default;

let subscriptionKey = process.env["AZURE_KEY"];

async function identifyFace(imageUrl) {
  let endpoint = process.env["AZURE_ENDPOINT"] + "/face/v1.0/detect";

  var faceId = await axios({
    method: "post",
    url: endpoint,
    params: {
      detectionModel: "detection_02", // Works with masks
      returnFaceId: true,
      recognitionModel: "recognition_03"
    },
    data: {
      url: imageUrl,
    },
    headers: { "Ocp-Apim-Subscription-Key": subscriptionKey },
  })
    .then(function (response) {
      console.log("Status text: " + response.status);
      console.log("Status text: " + response.statusText);
      console.log();
      console.log(response.data);
      return response.data[0].faceId;
    })
    .catch(function (error) {
      console.log(error);
    });
  return await fetch_identify(faceId, process.env.PERSONGID);
};

async function fetch_identify(faceId, personGroupId) {
  let endpoint = process.env["AZURE_ENDPOINT"] + "/face/v1.0/identify";

  return axios({
    method: "post",
    url: endpoint,
    data: {
      faceIds: [faceId],
      personGroupId: personGroupId
    },
    headers: {
      "Content-Type": 'application/json',
      "Ocp-Apim-Subscription-Key": subscriptionKey
    },
  })
    .then(function (response) {
      console.log("Status text: " + response.status);
      console.log("Status text: " + response.statusText);
      console.log();
      console.log(response.data.error);
      return response.data[0].candidates[0].personId;
    })
    .catch(function (error) {
      console.log(error);
    });
};

function makeid(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++ ) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

async function createGame(host, gfence, memberLimit, timeLimit) {
  var id = makeid(5);
  while (await Game.findOne({id: id}).exec()) {
    id = makeid(5);
  }

  await Game.create({
    id: id,
    lat: gfence.lat,
    long: gfence.long,
    bound: gfence.bound,
    rad: gfence.rad,
    host: host._id,
    timeLimit: timeLimit,
    memberLimit: memberLimit,
    players: [host._id]
  }, (err, doc) => {
    if (err) {
      console.log(err);
    } else {
      doc.save();
    }
  });
  return id;
};

async function createPerson(name_, userdata, faceUrl) {
  var personGroupId = process.env.PERSONGID;
  var personId = await fetch_createPerson(name_, userdata, personGroupId);
  await fetch_addFace(personId, faceUrl, personGroupId);
  await fetch_train();
  return personId;
};

async function fetch_addFace(personId, faceUrl, personGroupId) {
  let endpoint = process.env["AZURE_ENDPOINT"] +
    "face/v1.0/persongroups/" + personGroupId + "/persons/" +
    personId + "/persistedFaces";

  return await axios({
    method: "post",
    url: endpoint,
    params: {
      detectionModel: "detection_02",
      recognitionModel: "recognition_03"
    },
    data: {
      url: faceUrl
    },
    headers: {
      "Content-Type": 'application/json',
      "Ocp-Apim-Subscription-Key": subscriptionKey
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
}

async function fetch_train() {
  let endpoint = process.env["AZURE_ENDPOINT"] +
    "/face/v1.0/persongroups/" + process.env.PERSONGID + "/train/";

  return await axios({
    method: "post",
    url: endpoint,
    headers: {
      "Ocp-Apim-Subscription-Key": subscriptionKey
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
}

async function addFace(personId, faceUrl) {
  fetch_addFace(personId, faceUrl, process.env.PERSONGID);
  fetch_train();
}

async function fetch_createPerson(name_, uData, personGroupId) {

  let endpoint = process.env["AZURE_ENDPOINT"] +
    "/face/v1.0/persongroups/" + personGroupId + "/persons";

  return await axios({
    method: "post",
    url: endpoint,
    data: {
      name: name_
    },
    headers: {
      "Content-Type": 'application/json',
      "Ocp-Apim-Subscription-Key": subscriptionKey
    },
  })
    .then(function (response) {
      console.log("Status text: " + response.status);
      console.log("Status text: " + response.statusText);
      console.log();
      console.log(response.data);
      return response.data.personId;
    })
    .catch(function (error) {
      console.log(error);
    });
}

async function put_createPersonGroup(personGroupId) {
  let endpoint = process.env["AZURE_ENDPOINT"] + "/face/v1.0/persongroups/" + personGroupId;

  await axios({
    method: "put",
    url: endpoint,
    data: {
      name: "All Players",
      userData: "",
      recognitionModel: "recognition_03"
    },
    headers: {
      "Content-Type": 'application/json',
      "Ocp-Apim-Subscription-Key": subscriptionKey
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

async function delete_PersonGroup(personGroupId) {
  let endpoint = process.env["AZURE_ENDPOINT"] + "/face/v1.0/persongroups/" + personGroupId;

  await axios({
    method: "delete",
    url: endpoint,
    headers: {
      "Ocp-Apim-Subscription-Key": subscriptionKey
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

async function createUser(name_, apple_id, imageUrl, osId) {
  var userdata = {};
  var personId = await createPerson(name_, userdata, imageUrl).catch((err) => {
    throw "Error with CreatePerson";
  });
  var user_obj = {
    id: apple_id,
    osId: osId,
    personId: personId,
    name: name_,
    lastCoords: {lat: null, long: null},
    imageUrl: imageUrl
  };
  User.create(user_obj, (err, doc) => {
    if (err) {
      console.log(err);
    } else {
      doc.save();
    }
  });
}

async function gameExists(gameId) {
  var games = await Game.find({id: gameId});
  console.log(games.length);
  return games.length > 0;
};

async function getNumPlayers(gameID) {
  Game.find({ id: gameID }, (err, doc) => {
    if (err) {
      throw err;
    } else {
      if (doc.players) {
        return doc.players.length;
      }
      return 0;
    }
  });
}

async function getAvatar(playerID) {
  await User.findOne({ id: playerID }, (err, doc) => {
    if (err) throw err;
    return doc.imageUrl;
  })
};

async function init() {
  await put_createPersonGroup(process.env.PERSONGID);
};

async function getPlayerByAppleId(appleId) {
  return await User.findOne({ id: appleId }, (err, doc) => {
    if (err) throw err;
    return doc;
  });
};

async function getPlayerByPersonId(personId) {
  return await User.findOne({ personId: personId }, (err, doc) => {
    if (err) throw err;
    return doc;
  });
};

async function removePlayerFromGame(gameId, appleId) {
  var game = await Game.findOne({ id: gameId }, (err, doc) => {
    if (err) throw err;
    return doc;
  });
  game.update({ '$pull': { players: { id: appleId } } });
}

async function getLocs(gameId) {
  return await Game.findOne({id: gameId}).populate("players", (err, doc) => {
    if (err) throw err;
    var arr = doc.players;
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      var player = arr[i];
      result.push(player.lastCoords);
    }
    return result;
  });
}

async function getGame(gameId) {
  return await (await Game.findOne({id: gameId}).populate('host').populate('players'));
};

async function joinGame(gameId, appleId) {
  var game = await getGame(gameId);
  var player = await getPlayerByAppleId(appleId);
  console.log(player);
  if (game) {
    await Game.updateOne({id: gameId}, {$addToSet: {players: [player._id]}}, (err, doc) => {
      if (err) throw err;
    });
    return getGame(gameId);
  } else {
    return {error: "Game with code: " + gameId + " does not exist!"};
  }
}

async function clear() {
  await delete_PersonGroup(process.env.PERSONGID);
}

async function removeGame(gameId) {
  Game.deleteOne({id: gameId}).catch((err) => console.log(err));
}

function updateLoc(appleId, loc) {
  User.updateOne({id: appleId}, {lastCoords: loc}, {upsert: true});
};

module.exports = {
  getPlayerByPersonId,
  removePlayerFromGame,
  getNumPlayers,
  createUser,
  getPlayerByAppleId,
  getAvatar,
  identifyFace,
  createGame,
  init,
  clear,
  addFace,
  updateLoc,
  getLocs,
  joinGame,
  gameExists,
  getGame,
  removeGame,
  fetch_train
};
