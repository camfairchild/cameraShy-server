# cameraShy-server
Acts as the server for the [Camera-Shy](https://github.com/eladdekel/camerashy) game

# Project Updates
The server currently uses a REST API implemented in ExpressJS and NodeJS. This makes client updates not very efficient.
We plan to continue work on the game, transitioning it to websockets, for real-time client-server updates.
Development is happening when I have free-time to invest in the project.

# Installation
Can be installed by running
```bash
npm install
```

# Server API Reference
## RESTful API /api
### /api/createGame POST

Used to create a Game
#### __request body:__
```JSON
{
    appleId: string,
    numPlayers: number,
    time: number,
    lat: number,
    long: number,
    bound: [number],
    rad: number
}
```
#### __response:__
Status Code <span style="color:green">200</span>

Success, the Game was created. gameId is used to join

```JSON
{ gameId: gameId }
```
Also sends OneSig Notif to Host: 
```
Title: "Game Created!"
Text: "Join code: " + gameId,
```
Status Code <span style="color:red">404</span>

Host's appleId doesn't exist

```JSON
{error: "Host doesn't exist!"}
```
Status Code <span style="color:yellow">500</span>

Some other error

```JSON
{error: <error text>}
```


