"use strict";

/** TODO: Change to use different Face API PersonGroup for every game
  [] => needs testing
  [] PUT Create PersonGroup when making new Game using gameId for PersonGroupId
  [] DELETE Delete PersonGroup when Game ends
  [] POST Create new Person in PersonGroup
  [] POST Add Face using faceID of exisiting User Model to Person
  [] POST Train when PersonGroup is updated
  [] POST Detect with image of face. Recieve FaceId
    -> POST Identify with FaceId and Game's PersonGroupId/gameId
    -> The Person returned will be in the game and the correct Person
  [] Delete Person from PersonGroup when they leave game before start
  [] pull User from alive when they leave game after start
  [] search in PersonGroup for faceID when shooting
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
  lat: number;
  long: number;
  bound: number[];
  rad: number;
}

export function updateUserSocketId(appleId: string, socketId: string): void {
  User.findOne({ id: appleId }, (err, doc) => {
    if (err) throw err;
    if (doc) {
      doc.socketId = socketId;
      doc.save();
    }
  }).catch((err) => {
    console.log(`Error updating socketId of user[${appleId}]`);
  });
}

export async function identifyFace(imageUrl: string, gameId: string): Promise<string> {
  const endpoint = process.env["AZURE_ENDPOINT"] + "/face/v1.0/detect";

  const faceId = await axios
    .request<any>({
      method: "post",
      url: endpoint,
      params: {
        detectionModel: process.env.DETECTION_MODEL,
        returnFaceId: true,
        recognitionModel: process.env.RECOGNITION_MODEL,
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
  return await fetch_identify(faceId, gameId);
}

async function fetch_identify(faceId, personGroupId): Promise<string> {
  const endpoint = process.env["AZURE_ENDPOINT"] + "/face/v1.0/identify";

  return axios
    .request<any>({
      method: "post",
      url: endpoint,
      data: {
        faceIds: [faceId],
        personGroupId: personGroupId,
      },
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    })
    .then(function (response) {
      console.log("Status text: " + response.status);
      console.log("Status text: " + response.statusText);
      console.log();
      console.log(response.data);
      return response.data[0].candidates[0].personId;
    })
    .catch(function (error) {
      console.log(error);
    });
}

function makeid(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export async function createGame(
  host: IUser,
  gfence: Geofence,
  memberLimit: number,
  timeLimit: number
): Promise<string> {
  let id = makeid(5);
  while (await Game.findOne({ id: id }).exec()) {
    id = makeid(5);
  }

  Game.create(
    {
      id: id,
      lat: gfence.lat,
      long: gfence.long,
      bound: gfence.bound,
      rad: gfence.rad,
      host: host._id,
      timeLimit: timeLimit,
      memberLimit: memberLimit,
      players: [host._id],
    },
    async (err, doc) => {
      if (err) {
        console.log(err);
      } else {
        await doc.save();
      }
    }
  );
  put_createPersonGroup(id);
  return id;
}

async function createPerson(
  name_: string,
  userdata,
  faceUrl: string,
  gameId: string
): Promise<string> {
  const personGroupId = gameId;
  const personId = await fetch_createPerson(name_, userdata, personGroupId);
  await fetch_addFace(personId, faceUrl, personGroupId);
  await fetch_train(personGroupId);
  return personId;
}

async function fetch_addFace(
  personId,
  faceUrl,
  personGroupId: string
): Promise<void> {
  const endpoint =
    process.env["AZURE_ENDPOINT"] +
    "/face/v1.0/persongroups/" +
    personGroupId +
    "/persons/" +
    personId +
    "/persistedFaces";

  await axios
    .request<any>({
      method: "post",
      url: endpoint,
      params: {
        detectionModel: process.env.DETECTION_MODEL,
        recognitionModel: process.env.RECOGNITION_MODEL,
      },
      data: {
        url: faceUrl,
      },
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
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

async function fetch_train(personGroupId: string) {
  const endpoint =
    process.env["AZURE_ENDPOINT"] +
    "/face/v1.0/persongroups/" +
    personGroupId +
    "/train/";

  return await axios
    .request<any>({
      method: "post",
      url: endpoint,
      headers: {
        "Ocp-Apim-Subscription-Key": subscriptionKey,
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

export async function addFace(
  personId: string,
  faceUrl: string,
  personGroupId: string
): Promise<void> {
  await fetch_addFace(personId, faceUrl, personGroupId);
  await fetch_train(personGroupId);
}

async function fetch_createPerson(
  name_: string,
  uData: any,
  personGroupId: string
): Promise<string> {
  const endpoint =
    process.env["AZURE_ENDPOINT"] +
    "/face/v1.0/persongroups/" +
    personGroupId +
    "/persons";

  const personId = await axios
    .request<any>({
      method: "post",
      url: endpoint,
      data: {
        name: name_,
      },
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
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
      return null;
    });
  return personId;
}

async function put_createPersonGroup(personGroupId) {
  const endpoint =
    process.env["AZURE_ENDPOINT"] + "/face/v1.0/persongroups/" + personGroupId;

  await axios
    .request<any>({
      method: "put",
      url: endpoint,
      data: {
        name: "All Players",
        userData: "",
        recognitionModel: process.env.RECOGNITION_MODEL,
      },
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
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
  const endpoint =
    process.env["AZURE_ENDPOINT"] + "/face/v1.0/persongroups/" + personGroupId;

  await axios
    .request<any>({
      method: "delete",
      url: endpoint,
      headers: {
        "Ocp-Apim-Subscription-Key": subscriptionKey,
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

export async function createUser(
  name_: string,
  apple_id: string,
  imageUrl: string,
  osId,
  gameId: string
): Promise<void> {
  const userdata = {};
  const personId = await createPerson(name_, userdata, imageUrl, gameId).catch(
    (err) => {
      throw "Error with CreatePerson";
    }
  );
  const user_obj = {
    id: apple_id,
    osId: osId,
    personId: personId,
    name: name_,
    lastCoords: { lat: null, long: null },
    imageUrl: imageUrl,
  };
  try {
    const user = new User(user_obj);
    await user.save();
  } catch (err) {
    console.log(err);
  }
}

export async function gameExists(gameId: string): Promise<boolean> {
  const games = await Game.find({ id: gameId });
  console.log(games.length);
  return games.length > 0;
}

export async function getNumPlayers(gameId: string): Promise<number> {
  try {
    const allPlayers: Array<IUser> = await Game.aggregate([
      {
        $match: {
          id: gameId,
        },
      },
      {
        $unwind: "$players",
      },
      {
        $replaceRoot: {
          newRoot: "$players",
        },
      },
    ]);
    return allPlayers.length;
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function getNumPlayersAlive(gameId: string): Promise<number> {
  try {
    const alivePlayers: Array<IUser> = await Game.aggregate([
      {
        $match: {
          id: gameId,
        },
      },
      {
        $unwind: "$alive",
      },
      {
        $replaceRoot: {
          newRoot: "$alive",
        },
      },
    ]);
    return alivePlayers.length;
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function getAvatar(appleId: string): Promise<string> {
  await User.findOne({ id: appleId }, (err, doc: IUser) => {
    if (err) throw err;
    if (doc) {
      return doc.imageUrl;
    }
  });
  return null;
}

export async function getPlayerByAppleId(appleId: string): Promise<IUser> {
  return await User.findOne({ id: appleId }, (err, doc: IUser) => {
    if (err) throw err;
    return doc;
  });
}

export async function getPlayerByPersonId(personId: string): Promise<IUser> {
  return await User.findOne({ personId: personId }, (err, doc: IUser) => {
    if (err) throw err;
    return doc;
  });
}

export async function deletePlayerFromGame(gameId: string, appleId: string): Promise<void> {
  const game = await Game.findOne({ id: gameId }, (err, doc: IGame) => {
    if (err) throw err;
    return doc;
  });
  await game.update({ $pull: { players: { id: appleId }, alive: { id: appleId } } });
  // remove from PersonGroup
  const user: IUser = await getPlayerByAppleId(appleId);
  await delete_PersonFromPersonGroup(gameId, user.personId);
}

export async function removePlayerFromGame(gameId: string, appleId: string): Promise<void> {
  const game = await Game.findOne({ id: gameId }, (err, doc: IGame) => {
    if (err) throw err;
    return doc;
  });
  await game.update({ $pull: { alive: { id: appleId } } });
}

export async function delete_PersonFromPersonGroup(
  gameId: string,
  personID: string
): Promise<void> {
  const personGroupId = gameId;
  const endpoint =
    process.env["AZURE_ENDPOINT"] +
    "/face/v1.0/persongroups/" +
    personGroupId +
    "/persons/" +
    personID;

  await axios
    .request<any>({
      method: "delete",
      url: endpoint,
      headers: {
        "Ocp-Apim-Subscription-Key": subscriptionKey,
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

export async function getLocs(gameId: string): Promise<ICoords[]> {
  const game: IGame = await Game.findOne({ id: gameId }).populate(
    "players",
    (err, doc: IGame) => {
      if (err) throw err;
      return doc;
    }
  );
  const arr = game.players;
  const result: ICoords[] = [];
  for (let i = 0; i < arr.length; i++) {
    const player = arr[i];
    result.push(player.lastCoords);
  }
  return result;
}

export async function getGame(gameId: string): Promise<IGame> {
  return await await Game.findOne({ id: gameId })
    .populate("host")
    .populate("players");
}

export async function joinGame(
  gameId: string,
  appleId: string
): Promise<IGame> {
  const game = await getGame(gameId);
  const player = await getPlayerByAppleId(appleId);
  console.log(player);
  if (game) {
    await Game.updateOne(
      { id: gameId },
      {
        $addToSet: { players: player._id },
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

export async function clear(): Promise<void> {
  const games = await Game.find();
  games.forEach(async (game: IGame) => {
    await removeGame(game.id);
  });
}

/**
 * Removes/deletes a game by GameID
 * @param gameId the id of the game to remove
 * @returns true if the game was removed, false otherwise
 */
export async function removeGame(gameId: string): Promise<boolean> {
  try {
    await Game.deleteOne({ id: gameId });
    await delete_PersonGroup(gameId);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

export function updateLoc(appleId: string, loc: ICoords): void {
  console.log(loc);
  User.findOne({ id: appleId }, (err, doc: IUser) => {
    doc.lastCoords.lat = loc.lat;
    doc.lastCoords.long = loc.long;
    doc.save();
  });
}

export async function getHost(gameId: string): Promise<IUser> {
  const game: IGame = await getGame(gameId);
  return game.host;
}
Promise;
