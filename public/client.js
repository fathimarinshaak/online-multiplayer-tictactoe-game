const boardElement = document.getElementById("board");
const statusText = document.getElementById("status");
const roomList = document.getElementById("roomList");
const resetBtn = document.getElementById("resetBtn");
const leaveBtn = document.getElementById("leaveBtn");
const lobbyModal = document.getElementById("lobbyModal");

const ws = new WebSocket(
  location.protocol === "https:" ? `wss://${location.host}` : `ws://${location.host}`
);

let mySymbol = null;
let myTurn = false;
let gameOver = false;
let cells = Array(9).fill("");

const winPatterns = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

// Initialize Board
for (let i = 0; i < 9; i++) {
  const btn = document.createElement("button");
  btn.className = "cell";
  btn.onclick = () => makeMove(i);
  boardElement.appendChild(btn);
}

async function loadRooms() {
  try {
    const res = await fetch("/rooms");
    const rooms = await res.json();
    const joinableRooms = rooms.filter(r => r.players.length < 2);
    
    roomList.innerHTML = joinableRooms.length 
      ? "" 
      : "<li style='cursor:default; opacity:0.5; text-align:center;'>No open rooms.</li>";

    joinableRooms.forEach(r => {
      const li = document.createElement("li");
      li.innerHTML = `<div style="display:flex; justify-content:space-between; width:100%;">
          <span>${r.name}</span>
          <span style="font-size: 0.75rem; background: #38bdf8; color: #0f172a; padding: 4px 10px; border-radius: 20px; font-weight: bold;">Join</span>
        </div>`;
      li.onclick = () => joinRoom(r.roomId);
      roomList.appendChild(li);
    });
  } catch (e) { console.error(e); }
}
setInterval(loadRooms, 3000);
loadRooms();

async function createRoom() {
  const roomName = document.getElementById("roomInput").value || "Quick Match";
  const res = await fetch("/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomName }),
  });
  const { roomId } = await res.json();
  joinRoom(roomId);
}

function joinRoom(roomId) {
  const name = document.getElementById("nameInput").value || "Player";
  ws.send(JSON.stringify({ type: "join", roomId, name }));
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "start") {
    lobbyModal.style.display = "none";
    boardElement.style.display = "grid";
    leaveBtn.style.display = "block"; // Show leave button
    mySymbol = data.symbol;
    
    if (!data.opponent) {
      statusText.textContent = "Waiting for an opponent...";
      myTurn = false;
    } else {
      resetGameLocal();
    }
  }

  if (data.type === "opponent_joined") {
    statusText.textContent = `${data.name} joined!`;
    setTimeout(() => resetGameLocal(), 800);
  }

  if (data.type === "move") {
    cells[data.index] = data.symbol;
    updateBoardUI();
    if (!checkWinner()) {
      myTurn = true;
      updateStatusUI();
    }
  }

  if (data.type === "reset") resetGameLocal();

  if (data.type === "opponent_left") {
    statusText.textContent = "Opponent left the room.";
    gameOver = true;
    resetBtn.style.display = "none";
  }
};

function makeMove(index) {
  if (!myTurn || cells[index] || gameOver) return;
  cells[index] = mySymbol;
  updateBoardUI();
  myTurn = false;
  ws.send(JSON.stringify({ type: "move", index, symbol: mySymbol }));
  if (!checkWinner()) updateStatusUI();
}

function updateBoardUI() {
  const buttons = document.querySelectorAll(".cell");
  buttons.forEach((btn, i) => {
    btn.textContent = cells[i];
    btn.className = `cell ${cells[i]}`;
    btn.disabled = !!cells[i];
  });
}

function updateStatusUI() {
  if (gameOver) return;
  statusText.textContent = myTurn ? "Your Turn" : "Opponent's Turn";
}

function checkWinner() {
  for (let pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      statusText.textContent = cells[a] === mySymbol ? "Victory! 🎉" : "Defeat! 💀";
      gameOver = true;
      resetBtn.style.display = "block";
      return true;
    }
  }
  if (!cells.includes("")) {
    statusText.textContent = "Draw! 🤝";
    gameOver = true;
    resetBtn.style.display = "block";
    return true;
  }
  return false;
}

function requestReset() { ws.send(JSON.stringify({ type: "reset" })); }

function resetGameLocal() {
  cells = Array(9).fill("");
  gameOver = false;
  resetBtn.style.display = "none";
  myTurn = (mySymbol === "X");
  updateBoardUI();
  updateStatusUI();
}

/** * NEW: LEAVE ROOM FUNCTION 
 * Resets the client state and shows the lobby again
 */
function leaveRoom() {
  // We reload to clear all WebSocket and game states cleanly
  window.location.reload(); 
}