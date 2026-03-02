const express = require("express");
const WebSocket = require("ws");
require('dotenv').config();

const app = express();
app.use(express.static("public"));

const port = process.env.PORT||5000

const server = app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);

const wss = new WebSocket.Server({ server });

let waitingPlayer = null;

wss.on("connection", (ws) => {
  ws.symbol = null;
  ws.opponent = null;

  if (waitingPlayer) {
    ws.symbol = "O";
    ws.opponent = waitingPlayer;
    waitingPlayer.opponent = ws;
    waitingPlayer.symbol = "X";

    ws.send(JSON.stringify({ type: "start", symbol: "O" }));
    waitingPlayer.send(JSON.stringify({ type: "start", symbol: "X" }));

    waitingPlayer = null;
  } else {
    waitingPlayer = ws;
    ws.send(JSON.stringify({ type: "waiting" }));
  }

  ws.on("message", (msg) => {
    if (ws.opponent) {
      ws.opponent.send(msg.toString());
    }
  });

  ws.on("close", () => {
    if (ws.opponent) {
      ws.opponent.send(JSON.stringify({ type: "opponent_left" }));
    }
    if (waitingPlayer === ws) waitingPlayer = null;
  });
});