module.exports = function (app, db) {
    var apiRouter = require("./api");
    
    app.use("/api", apiRouter);
    
    app.use((req, res, next) => {
      res.status(404)
        .type('text')
        .send('Not Found');
    });
}