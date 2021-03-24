import { router as indexRouter } from "./index";
import {router as apiRouter } from "./api";  
import { ioRouter } from './io';
import { Server } from "socket.io";

export function routes(app, sio: Server) {
    app.use(indexRouter);
    app.use(apiRouter);

    sio.sockets.on('connection', (socket) => {
      ioRouter(sio, socket);
    });

    app.use((req: any, res: any) => {
      res.status(404)
        .type('text')
        .send('Not Found');
    });
}