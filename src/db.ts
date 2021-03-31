"use strict";

/** TODO: Change to use different Face API PersonGroup for every game
  - PUT Create PersonGroup when making new Game using gameId for PersonGroupId
  - DELETE Delete PersonGroup when Game ends
  - POST Create new Person in PersonGroup
  - POST Add Face using faceID of exisiting User Model to Person
  - POST Train when PersonGroup is updated
  - POST Detect with image of face. Recieve FaceId
    -> POST Identify with FaceId and Game's PersonGroupId/gameId
    -> The Person returned will be in the game and the correct Person
  - DELETE Delete Person from PersonGroup when they leave game
  - search in PersonGroup for faceID when shooting
    -> can use PersonGroup to tell if face is in game 
      without knowing if they are a player
*/

import dotenv from "dotenv";
dotenv.config();

import Game, { IGame } from "./models/Game";
import User, { IUser, ICoords } from "./models/User";
import axios from "axios";

const subscriptionKey = process.env["AZURE_KEY"];

class Geofence {
  lat: number
  long:  number
  bound: number[]
  rad: number
}

  User.findOne({id: appleId}, (err, doc) => {
    if (err) throw err;
    if (doc) {
      doc.socketId = socketId;
      doc.save();
    }
  }).catch((err) => {
    console.log(`Error updating socketId of user[${appleId}]`)
  });
}

export async function identifyFace(imageUrl) {
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
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export async function createGame(host: IUser, gfence, memberLimit: number, timeLimit: number) {
  let id = makeid(5);
  while (await Game.findOne({ id: id }).exec()) {
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

export async function addFace(personId, faceUrl) {
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

export async function createUser(name_, apple_id, imageUrl, osId) {
  const userdata = {};
  const personId = await createPerson(name_, userdata, imageUrl).catch((err) => {
    throw "Error with CreatePerson";
  });
  const user_obj = {
    id: apple_id,
    osId: osId,
    personId: personId,
    name: name_,
    lastCoords: { lat: null, long: null },
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

export async function gameExists(gameId) {
  const games = await Game.find({ id: gameId });
  console.log(games.length);
  return games.length > 0;
}

export async function getNumPlayers(gameId: string): Promise<number> {
  const game: IGame = await Game.findOne({ id: gameId }, (err, doc: IGame) => {
    if (err) {
      throw err;
    } else {
      return doc;
    }
  });
  if (game != null) {
    return game.players.length;
  }
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

export async function getPlayerByAppleId(appleId): Promise<IUser> {
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
  return await Game.findOne({ id: gameId }).populate("players", (err, doc: IGame) => {
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
  return await (await Game.findOne({ id: gameId }).populate('host').populate('players'));
}

export async function joinGame(gameId, appleId) {
  const game = await getGame(gameId);
  const player = await getPlayerByAppleId(appleId);
  console.log(player);
  if (game) {
    await Game.updateOne(
      { id: gameId },
      {
        $addToSet:
          { players: player._id }
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
  Game.deleteOne({ id: gameId }).catch((err) => { throw err });
}

export function updateLoc(appleId, loc) {
  console.log(loc);
  User.findOne({ id: appleId }, (err, doc) => {
    doc.lastCoords = loc;
    doc.save();
  });
}

export async function getHost(gameId: string): Promise<IUser> {
  const game: IGame = await getGame(gameId);
  return game.host;
}
