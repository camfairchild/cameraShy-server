import express from 'express';
export const router = express.Router();

router.get('/', function(req, res) {
  res.render('index');
});

router.get('/.well-known/acme-challenge/laAtdnLp-PsYG09vAsXYUwkzIjEelWSew2t69vimqkE', (req, res) => {
  res.send("laAtdnLp-PsYG09vAsXYUwkzIjEelWSew2t69vimqkE.AxYds3Vqa4u7emgWINWqa1oXF7zRxfV1gNa4AO1afys")
})
