import io from 'socket.io';
import * as db from "../db";
import * as one_sig from "../one_signal";

export async function ioRouter(socket: io.Socket) {  
    
    socket.on("join", (appleId, gameId) => {
        // User with appleId joins game with gameId
        // Subscribe socket to room for game
        const user = db.getPlayerByAppleId(appleId);
        if (user == null) {
            socket.emit("join", {status : 404, error: "User with appleId does not exist"});
            return;
        }
        db.joinGame(gameId, appleId).then((game) => {
            socket.emit("join", {
                status : 200,
                game: game,
                numPlayers: game.players.length
                });
        }).catch(() => {
            socket.emit("join", {
                status : 404,
                error: "Game with gameId does not exist"
            });
            return;
        });
        // Join room gameId
        socket.join(gameId);
    });

    socket.on("start game", (appleId, gameId, time) => {
        // Check if game exists
        // Check if host has appleId
        socket.to(gameId).emit('game started', {gameId: gameId, startTime: time});
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
      db.removePlayerFromGame(gameId, appleId).then(
      socket.emit("success", `Left game[${gameId}] successfully!`));
      socket.to(gameId).emit(
        "player left",
        {appleId: appleId}
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

async function verifyHost(appleId, gameId) {
  const game = await db.getGame(gameId);
  return game.host.id == appleId;
}

function endGame(gameId: string, early: boolean) {
  db.getGame(gameId).then((game) => {if (game) {
    const numPlayers = game.players.length;
    socket.to(gameId).emit("game over", {game_end: 1, numPlayers: numPlayers, early: early});
    notifyGame(game, "Game Over!", 
    "The game has ended. " + numPlayers + " players left!",
     {game_end: 1, numPlayers: numPlayers});
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

};