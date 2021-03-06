import io from 'socket.io';
import * as db from "../db";

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
        socket.to(gameId).emit('start game', {gameId: gameId, startTime: time});
    });
};