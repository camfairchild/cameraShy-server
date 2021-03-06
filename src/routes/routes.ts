import indexRouter from "./index";
import apiRouter from "./api";  
import * as ioRouter from './io';

export function routes(app: Express.Application, io: ) {
    app.use(indexRouter);
    app.use(apiRouter);

    io.sockets.on('connection', (socket) => {
      ioRouter(db, socket);
    });

    app.use((req: any, res: any) => {
      res.status(404)
        .type('text')
        .send('Not Found');
    });
}