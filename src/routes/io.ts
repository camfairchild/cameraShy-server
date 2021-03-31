import io from 'socket.io';
import * as db from "../db";
import * as one_sig from "../one_signal";
import fs from 'fs';
import { IUser } from "../models/User";
import path from 'path';

interface Coord {
  lat: number,
  long: number
}

export async function ioRouter(sio: io.Server, socket: io.Socket): Promise<void> {
  function addSocketIdToUser(appleId: string, socketId: string): void {
    db.updateUserSocketId(appleId, socketId);
  }

  socket.on("join", async (appleId, gameId) => {
    // Update user wih socketId
    addSocketIdToUser(appleId, socket.id);
    // User with appleId joins game with gameId
    // Subscribe socket to room for game
    const user: IUser = await db.getPlayerByAppleId(appleId);
    if (user == null) {
      socket.emit("join", { status: 404, error: "User with appleId does not exist" });
      return;
    }
    db.joinGame(gameId, appleId).then((game) => {
      socket.emit("join", {
        status: 200,
        game: game,
        numPlayers: game.players.length
      });
    }).catch(() => {
      socket.emit("join", {
        status: 404,
        error: "Game with gameId does not exist"
      });
      return;
    });
    // Join room gameId
    socket.join(gameId);
    socket.to(gameId).emit("player joined", {
      player: user
    });
  });

  socket.on("start game", (appleId, gameId, time) => {
    // Check if game exists
    // Check if host has appleId
    socket.to(gameId).emit('game started', { gameId: gameId, startTime: time });
  });

  socket.on("cancel game", (appleId, gameId) => {
    db.gameExists(gameId).then((exists) => {
      if (exists && verifyHost(appleId, gameId)) {
        endGame(gameId, true);
        socket.emit("success", "The game was ended successfully");
        console.log(`Host[${appleId}] ended game[${gameId}]`)
      } else {
        console.log(`Player[${appleId}] that is not the host tried to end the game[${gameId}] early!`);
        socket.emit("error", "Only the host can end the game!");
      }
    })
  });

  socket.on("leave game", (appleId, gameId) => {
    db.gameExists(gameId).then((exists) => {
      if (exists) {
        db.removePlayerFromGame(gameId, appleId).then((left) => {
          socket.emit("success", `Left game[${gameId}] successfully!`)
        })
          .catch((err) => {
            socket.emit("error", `Not in game[${gameId}]!`)
          });
        socket.to(gameId).emit(
          "player left",
          { appleId: appleId }
        );
        console.log(`Player[${appleId}] left game[${gameId}]`);
      } else {
        console.log(`Error. Player[${appleId}] tried to leave game[${gameId}] that doesn't exist`);
        socket.emit("error", `game[${gameId}] does not exist!`);
      }
    }).catch((err) => {
      console.log(err);
    })
  });

  socket.on('shoot', (appleId, img, loc, gameId) => {
    const buffer = Buffer.from(img);
    fs.writeFile('/tmp/image', buffer, async () => {
      socket.emit("upload status", 200);

      const imgUrl: string = path.join(__dirname + '/../public/uploads/') + `${Date.now()}.png`;
      const shooter: IUser = await db.getPlayerByAppleId(appleId);
      const victim: IUser = await checkShot(gameId, imgUrl, loc) as IUser;

      if (victim !== null) {
        db.removePlayerFromGame(gameId, appleId);
        const game = await db.getGame(gameId);
        const numPlayers = game.players.length;
        // Tell victim
        sio.to(victim.socketId).emit("shot", {
          imgUrl: imgUrl,
          shooter: shooter,
          numPlayers: numPlayers
        });
        // Tell shooter
        socket.emit("shoot", {
          status: 200,
          imgUrl: imgUrl,
          victim: victim
        });
        // Tell game
        socket.to(gameId).emit("player shot",
          {
            imgUrl: imgUrl,
            victim: victim.name,
            shooter: shooter,
            numPlayers: numPlayers
          }
        );

        notifyGame(game, victim.name + " was eliminated!",
          numPlayers + " players remain...",
          { numPlayers: numPlayers });
        one_sig.sendOSnotif(victim.osId, "Oof... Eliminated!",
          "You were shot by " + shooter.name,
          { numPlayers: numPlayers });

        console.log(`Player[${appleId}] shot and hit player[${victim.id}]!`);
      } else {
        console.log(`Player[${appleId}] shot but missed!`);
        // Tell shooter they missed
        socket.emit("shoot", {
          status: 400,
          message: "You missed"
        });
      }
    })
  });

  socket.on("location", (appleId: string, lat: number, long: number, gameId: string) => {
    const loc = { lat: lat, long: long };
    db.updateLoc(appleId, loc);
    db.getLocs(gameId).then((arr) => {
      // Send array of locations to the sender
      socket.emit("location", { locations: arr });
    });
  });

  async function checkShot(gameId, imgUrl, loc) {
    const personId = await db.identifyFace(imgUrl);
    console.log(personId);
    if (personId) {
      const person = await db.getPlayerByPersonId(personId);
      console.log(person);
      if (await db.getNumPlayers(gameId) == 1) {
        endGame(gameId, false);
      }
      db.addFace(personId, imgUrl);
      if (checkLoc(loc, person.lastCoords)) {
        return person;
      }
    }
    return null;
  }

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

  async function verifyHost(appleId: string, gameId: string) {
    const game = await db.getGame(gameId);
    return game.host.id == appleId;
  }

  function endGame(gameId: string, early: boolean) {
    db.getGame(gameId).then((game) => {
      if (game) {
        const numPlayers = game.players.length;
        socket.to(gameId).emit("game over", { game_end: 1, numPlayers: numPlayers, early: early });
        notifyGame(game, "Game Over!",
          "The game has ended. " + numPlayers + " players left!",
          { game_end: 1, numPlayers: numPlayers });
        db.removeGame(gameId);
      } else {
        socket.emit("error", `The game[${gameId}] does not exist!`)
      }
    }).catch((err) => {
      console.log(err);
    });
  }

  async function notifyGame(game, title, msg, data) {
    for (let i = 0; i < game.players.length; i++) {
      const osId = game.players[i].osId;
      one_sig.sendOSnotif(osId, title, msg, data);
    }
  }

}