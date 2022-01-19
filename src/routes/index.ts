import express from 'express';
import axios from 'axios';
import * as db from "../db";
export const router = express.Router();

router.get('/', async function(req, res) {
  const games = await db.getAllGames();
  const users = await db.getAllUsers();
  res.render('index', {
    games: games,
    users: users
  });
});

router.get('/.well-known/acme-challenge/laAtdnLp-PsYG09vAsXYUwkzIjEelWSew2t69vimqkE', (req, res) => {
  res.send("laAtdnLp-PsYG09vAsXYUwkzIjEelWSew2t69vimqkE.AxYds3Vqa4u7emgWINWqa1oXF7zRxfV1gNa4AO1afys")
})
