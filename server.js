const express = require("express");
const WebSocket = require("ws");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
app.use(express.static("public"));
app.use(express.json());

const port = process.env.PORT || 5000;
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});

const wss = new WebSocket.Server({ server });

const rooms = {}; 

app.get("/rooms", (req, res) => {
  const list = Object.entries(rooms).map(([id, room]) => ({
    roomId: id,
    name: room.name,
    players: room.players.map(p => p.name),
  }));
  res.json(list);
});

app.post("/rooms", (req, res) => {
  const { roomName } = req.body;
  const roomId = crypto.randomUUID();
  rooms[roomId] = { name: roomName, players: [] };
  res.json({ roomId });
});

wss.on("connection", (ws) => {
  ws.roomId = null;

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "join") {
      const room = rooms[data.roomId];
      if (!room || room.players.length >= 2) {
        ws.send(JSON.stringify({ type: "error", message: "Room full or missing" }));
        return;
      }

      ws.roomId = data.roomId;
      ws.playerName = data.name;
      ws.symbol = room.players.length === 0 ? "X" : "O";

      room.players.push({ ws, name: ws.playerName, symbol: ws.symbol });

      ws.send(JSON.stringify({
        type: "start",
        symbol: ws.symbol,
        opponent: room.players.find(p => p.ws !== ws)?.name || null,
      }));

      room.players.forEach(p => {
        if (p.ws !== ws) {
          p.ws.send(JSON.stringify({ type: "opponent_joined", name: ws.playerName }));
        }
      });
    }

    if (data.type === "move") {
      const room = rooms[ws.roomId];
      if (!room) return;
      room.players.forEach(p => {
        if (p.ws !== ws && p.ws.readyState === WebSocket.OPEN) {
          p.ws.send(JSON.stringify(data));
        }
      });
    }

    /* PLAY AGAIN HANDLER */
    if (data.type === "reset") {
      const room = rooms[ws.roomId];
      if (!room) return;
      room.players.forEach(p => {
        if (p.ws.readyState === WebSocket.OPEN) {
          p.ws.send(JSON.stringify({ type: "reset" }));
        }
      });
    }
  });

  ws.on("close", () => {
    if (!ws.roomId) return;
    const room = rooms[ws.roomId];
    if (!room) return;
    room.players = room.players.filter(p => p.ws !== ws);
    room.players.forEach(p => p.ws.send(JSON.stringify({ type: "opponent_left" })));
    if (room.players.length === 0) delete rooms[ws.roomId];
  });
});