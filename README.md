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
```TypeScript
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

```TypeScript
{ gameId: gameId }
```
Also sends OneSig Notif to Host: 
```
Title: "Game Created!"
Text: "Join code: " + gameId,
```
Status Code <span style="color:red">404</span>

Host's appleId doesn't exist

```TypeScript
{error: "Host doesn't exist!"}
```
Status Code <span style="color:yellow">500</span>

Some other error

```TypeScript
{error: "error text"}
```

### /api/createUser POST

Used to create a User
#### __request body:__
```TypeScript
{
    name: string,
    id: number, // Apple Login ID
    osId: number // One Signal ID
}
```
##### __extra:__
Image of face. Field Name: `img`
#### __response:__
Status Code <span style="color:green">200</span>

Success, the User was created. appleId is used to reference User

Status Code <span style="color:yellow">500</span>

Some other error

```TypeScript
{error: "error text"}
```

### /api/gallery GET

Used to get the URL of all files in the Gallery
#### __request params:__
None

#### __response:__
Status Code <span style="color:green">200</span>

Success.

```TypeScript
{ fnames: [
    // Relative file URLs
    "/uploads/file.jpg",
    "/uploads/file.png"
]
}
```
##### __extra:__
Will return empty array if there are no images in Gallery.

Status Code <span style="color:yellow">500</span>

Some other error

```TypeScript
{error: "error text"}
```

### /api/avatar GET

Used to get the URL of the avatar for the User with appleId
#### __request params:__
```TypeScript
{ appleId: string }
```

#### __response:__
Status Code <span style="color:green">200</span>

Success.

```TypeScript
{ avatarUrl: string }
```

Status Code <span style="color:green">404</span>

Error: User with appleId does not exist

```TypeScript
{ error: `User with appleId ${appleId} does not exist` }
```

Status Code <span style="color:yellow">500</span>

Some other error

```TypeScript
{error: "error text"}
```

### /api/numPlayers GET

Used to get the number of Users in the Game with gameId
#### __request params:__
```TypeScript
{ gameId: string }
```

#### __response:__
Status Code <span style="color:green">200</span>

Success.

```TypeScript
{ numPlayers: number }
```

Status Code <span style="color:green">404</span>

Error: Game with gameId does not exist.

```TypeScript
{ error: `Game with gameId ${gameId} does not exist` }
```

Status Code <span style="color:yellow">500</span>

Some other error

```TypeScript
{error: "error text"}
```

