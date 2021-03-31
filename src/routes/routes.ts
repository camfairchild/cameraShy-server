import { router as indexRouter } from "./index";
import {router as apiRouter } from "./api";  
import { ioRouter } from './io';
import { Server } from "socket.io";
import { Express } from "express";

export function routes(app: Express, sio: Server): void {
    app.use('/', indexRouter);
    app.use('/api', apiRouter);

    sio.sockets.on('connection', (socket) => {
      ioRouter(sio, socket);
    });

    app.use((_req, res) => {
      res.status(404)
        .type('text')
        .send('Not Found');
    });
}