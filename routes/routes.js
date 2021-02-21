
var apiRouter = require("./api");

module.exports = function (app, db) {
    app.use("/api", apiRouter);
    
    app.use((req, res, next) => {
      res.status(404)
        .type('text')
        .send('Not Found');
    });
  
}