"use strict";
import dotenv from "dotenv";
dotenv.config();

import Game, { IGame } from "./models/Game";
import User, { IUser } from "./models/User";
import mongoose, {Schema, Document} from 'mongoose';
import axios from "axios";


const subscriptionKey = process.env["AZURE_KEY"];

async function identifyFace(imageUrl) {
  const endpoint = process.env["AZURE_ENDPOINT"] + "/face/v1.0/detect";

  const faceId = await axios({
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
}

async function fetch_identify(faceId, personGroupId) {
  const endpoint = process.env["AZURE_ENDPOINT"] + "/face/v1.0/identify";

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
}

function makeid(length) {
  let result           = '';
  const characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++ ) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

async function createGame(host, gfence, memberLimit, timeLimit) {
  let id = makeid(5);
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
}

async function createPerson(name_, userdata, faceUrl) {
  const personGroupId = process.env.PERSONGID;
  const personId = await fetch_createPerson(name_, userdata, personGroupId);
  await fetch_addFace(personId, faceUrl, personGroupId);
  await fetch_train();
  return personId;
}

async function fetch_addFace(personId, faceUrl, personGroupId) {
  const endpoint = process.env["AZURE_ENDPOINT"] +
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
  const endpoint = process.env["AZURE_ENDPOINT"] +
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

  const endpoint = process.env["AZURE_ENDPOINT"] +
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
  const endpoint = process.env["AZURE_ENDPOINT"] + "/face/v1.0/persongroups/" + personGroupId;

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
}

async function delete_PersonGroup(personGroupId) {
  const endpoint = process.env["AZURE_ENDPOINT"] + "/face/v1.0/persongroups/" + personGroupId;

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
}

async function createUser(name_, apple_id, imageUrl, osId) {
  const userdata = {};
  const personId = await createPerson(name_, userdata, imageUrl).catch((err) => {
    throw "Error with CreatePerson";
  });
  const user_obj = {
    id: apple_id,
    osId: osId,
    personId: personId,
    name: name_,
    lastCoords: {lat: null, long: null},
    imageUrl: imageUrl
  };
  User.create(user_obj, (err, doc: IUser) => {
    if (err) {
      console.log(err);
    } else {
      doc.save();
    }
  });
}

async function gameExists(gameId) {
  const games = await Game.find({id: gameId});
  console.log(games.length);
  return games.length > 0;
}

async function getNumPlayers(gameID) {
  Game.find({ id: gameID }, (err, doc: IGame) => {
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

export async function getAvatar(appleId: string): Promise<string> {
  await User.findOne({ id: appleId }, (err, doc: IUser) => {
    if (err) throw err;
    return doc.imageUrl;
  })
  return null;
}

export async function init(): Promise<void> {
  return await put_createPersonGroup(process.env.PERSONGID);
}

export async function getPlayerByAppleId(appleId) {
  return await User.findOne({ id: appleId }, (err, doc: IUser) => {
    if (err) throw err;
    return doc;
  });
}

export async function getPlayerByPersonId(personId) {
  return await User.findOne({ personId: personId }, (err, doc: IUser) => {
    if (err) throw err;
    return doc;
  });
}

export async function removePlayerFromGame(gameId, appleId) {
  const game = await Game.findOne({ id: gameId }, (err, doc: IGame) => {
    if (err) throw err;
    return doc;
  });
  game.update({ '$pull': { players: { id: appleId } } });
}

export async function getLocs(gameId) {
  return await Game.findOne({id: gameId}).populate("players", (err, doc: IGame) => {
    if (err) throw err;
    const arr = doc.players;
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const player = arr[i];
      result.push(player.lastCoords);
    }
    return result;
  });
}

export async function getGame(gameId) {
  return await (await Game.findOne({id: gameId}).populate('host').populate('players'));
}

export async function joinGame(gameId, appleId) {
  const game = await getGame(gameId);
  const player = await getPlayerByAppleId(appleId);
  console.log(player);
  if (game) {
    await Game.updateOne(
      {id: gameId},
      {$addToSet: 
        {players: [player._id]}
      }, 
      {},
      (err) => {
        if (err) throw err;
      }
    );
    return getGame(gameId);
  } else {
    throw "Game does not exist";
  }
}

export async function clear() {
  await delete_PersonGroup(process.env.PERSONGID);
}

export async function removeGame(gameId) {
  Game.deleteOne({id: gameId}).catch((err) => {throw err});
}

export function updateLoc(appleId, loc) {
  console.log(loc);
  User.findOne({id: appleId}, (err, doc) => {
    doc.lastCoords = loc;
    doc.save();
  });
}

module.exports = {
  getNumPlayers,
  createUser,
  getAvatar,
  identifyFace,
  createGame,
  init,
  addFace,
  gameExists,
  fetch_train
};
