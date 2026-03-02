const ws = new WebSocket(`ws://${location.host}`);
const board = document.getElementById("board");
const statusText = document.getElementById("status");

let mySymbol = null;
let myTurn = false;
let gameOver = false;
let cells = Array(9).fill("");

const winPatterns = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

for (let i = 0; i < 9; i++) {
  const btn = document.createElement("button");
  btn.className = "cell";
  btn.onclick = () => makeMove(i);
  board.appendChild(btn);
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "waiting") {
    statusText.textContent = "Waiting for opponent...";
  }

  if (data.type === "start") {
    mySymbol = data.symbol;
    myTurn = mySymbol === "X";
    gameOver = false;
    statusText.textContent = `You are ${mySymbol}. ${myTurn ? "Your turn" : "Opponent's turn"}`;
  }

  if (data.type === "move") {
    if (gameOver) return;

    cells[data.index] = data.symbol;
    updateBoard();

    if (checkWin(data.symbol)) {
      gameOver = true;
      statusText.textContent = "You lose 😞";
      return;
    }

    if (checkDraw()) {
      gameOver = true;
      statusText.textContent = "Draw 🤝";
      return;
    }

    myTurn = true;
    statusText.textContent = "Your turn";
  }

  if (data.type === "opponent_left") {
    gameOver = true;
    statusText.textContent = "Opponent disconnected";
  }
};

function makeMove(index) {
  if (!myTurn || cells[index] || gameOver) return;

  cells[index] = mySymbol;
  updateBoard();

  if (checkWin(mySymbol)) {
    gameOver = true;
    statusText.textContent = "You win 🎉";
    sendMove(index);
    return;
  }

  if (checkDraw()) {
    gameOver = true;
    statusText.textContent = "Draw 🤝";
    sendMove(index);
    return;
  }

  myTurn = false;
  statusText.textContent = "Opponent's turn";
  sendMove(index);
}

function sendMove(index) {
  ws.send(JSON.stringify({
    type: "move",
    index,
    symbol: mySymbol
  }));
}

function checkWin(symbol) {
  return winPatterns.some(pattern =>
    pattern.every(i => cells[i] === symbol)
  );
}

function checkDraw() {
  return cells.every(cell => cell !== "");
}

function updateBoard() {
  const cellElements = document.querySelectorAll(".cell");
  cellElements.forEach((cell, i) => {
    cell.textContent = cells[i];
    cell.disabled = cells[i] !== "" || gameOver;
    
    cell.classList.remove("X", "O");
    if (cells[i]) {
      cell.classList.add(cells[i]);
    }
  });
}