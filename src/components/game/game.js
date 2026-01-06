const winPatterns = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createGameManager(dom, { log }) {
  const {
    boardEl,
    playerSymbolEl,
    turnIndicatorEl,
    resultEl,
    resetGameBtn,
    scoreYouEl,
    scoreOpponentEl,
    scoreDrawsEl,
    scoreYouLabel,
    scoreOpponentLabel,
  } = dom;

  const sessionState = {
    hostSymbol: "X",
    guestSymbol: "O",
    scoreboard: {
      host: 0,
      guest: 0,
      draws: 0,
    },
  };

  const gameState = {
    board: Array(9).fill(null),
    currentTurn: "X",
    playerSymbol: null,
    winner: null,
    connected: false,
    roundComplete: false,
  };

  let currentRole = null;
  let outbound = () => {};

  function setOutboundHandler(handler) {
    outbound = handler ?? (() => {});
  }

  function initializeSessionState() {
    sessionState.hostSymbol = "X";
    sessionState.guestSymbol = "O";
    sessionState.scoreboard = { host: 0, guest: 0, draws: 0 };
    updateScoreboardUI();
  }

  function applySessionState(nextState) {
    if (!nextState) return;
    sessionState.hostSymbol = nextState.hostSymbol ?? "X";
    const guestSymbol =
      nextState.guestSymbol ?? (sessionState.hostSymbol === "X" ? "O" : "X");
    sessionState.guestSymbol =
      guestSymbol === sessionState.hostSymbol
        ? sessionState.hostSymbol === "X"
          ? "O"
          : "X"
        : guestSymbol;
    sessionState.scoreboard = {
      host: nextState.scoreboard?.host ?? 0,
      guest: nextState.scoreboard?.guest ?? 0,
      draws: nextState.scoreboard?.draws ?? 0,
    };
    updatePlayerSymbol();
    updateScoreboardUI();
  }

  function setRole(role) {
    currentRole = role;
    updatePlayerSymbol();
    updateScoreboardUI();
  }

  function setConnectionState(isConnected) {
    gameState.connected = isConnected;
    if (!isConnected) {
      gameState.roundComplete = false;
    }
    updateBoardUI();
  }

  function updatePlayerSymbol() {
    if (!currentRole) {
      gameState.playerSymbol = null;
    } else if (currentRole === "host") {
      gameState.playerSymbol = sessionState.hostSymbol;
    } else {
      gameState.playerSymbol = sessionState.guestSymbol;
    }
    playerSymbolEl.textContent = gameState.playerSymbol ?? "-";
  }

  function updateScoreboardUI() {
    const { host, guest, draws } = sessionState.scoreboard;
    if (!currentRole) {
      scoreYouLabel.textContent = "You";
      scoreOpponentLabel.textContent = "Friend";
      scoreYouEl.textContent = host;
      scoreOpponentEl.textContent = guest;
    } else if (currentRole === "host") {
      scoreYouLabel.textContent = "You (Host)";
      scoreOpponentLabel.textContent = "Friend (Guest)";
      scoreYouEl.textContent = host;
      scoreOpponentEl.textContent = guest;
    } else {
      scoreYouLabel.textContent = "You (Guest)";
      scoreOpponentLabel.textContent = "Friend (Host)";
      scoreYouEl.textContent = guest;
      scoreOpponentEl.textContent = host;
    }
    scoreDrawsEl.textContent = draws;
  }

  function updateRoundActionButton() {
    if (!resetGameBtn) return;
    resetGameBtn.textContent = gameState.roundComplete
      ? "Start next round"
      : "Reset board";
  }

  function updateBoardUI() {
    for (let i = 0; i < gameState.board.length; i += 1) {
      const cell = boardEl.querySelector(`[data-cell=\"${i}\"]`);
      if (cell) {
        cell.textContent = gameState.board[i] ?? "";
        cell.classList.toggle("filled", Boolean(gameState.board[i]));
      }
    }
    const activeTurn =
      gameState.connected && !gameState.roundComplete
        ? gameState.currentTurn
        : "-";
    turnIndicatorEl.textContent = activeTurn;
    if (gameState.roundComplete) {
      if (gameState.winner) {
        resultEl.textContent = `${gameState.winner} wins!`;
      } else {
        resultEl.textContent = "Draw!";
      }
    } else if (!gameState.connected) {
      resultEl.textContent = currentRole
        ? "Waiting for connection"
        : "Game not started";
    } else {
      resultEl.textContent = "Game in progress";
    }
    updateRoundActionButton();
  }

  function handleCellClick(index) {
    if (!gameState.connected) {
      log?.("Not connected yet.");
      return;
    }
    if (gameState.roundComplete || gameState.board[index]) {
      return;
    }
    if (gameState.playerSymbol !== gameState.currentTurn) {
      log?.("It's not your turn yet.");
      return;
    }
    playMove(index, gameState.playerSymbol, true);
  }

  function playMove(index, symbol, isLocal) {
    if (gameState.board[index] || gameState.roundComplete) {
      return;
    }
    gameState.board[index] = symbol;
    const winner = checkWinner();
    const isDraw = !winner && !gameState.board.includes(null);
    if (winner || isDraw) {
      gameState.winner = winner ?? null;
      gameState.roundComplete = true;
    } else {
      gameState.currentTurn = symbol === "X" ? "O" : "X";
    }
    updateBoardUI();
    if (isLocal) {
      outbound({ type: "move", index, symbol });
      if (gameState.roundComplete) {
        finalizeRound(winner ? { winner } : { draw: true });
      }
    }
  }

  function finalizeRound(outcome) {
    updateScoreboardForOutcome(outcome);
    updateScoreboardUI();
    updateRoundActionButton();
    outbound({ type: "roundComplete", outcome, session: sessionState });
  }

  function updateScoreboardForOutcome(outcome) {
    if (outcome.winner) {
      const winnerRole = getRoleForSymbol(outcome.winner);
      if (winnerRole) {
        sessionState.scoreboard[winnerRole] += 1;
      }
    } else if (outcome.draw) {
      sessionState.scoreboard.draws += 1;
    }
  }

  function getRoleForSymbol(symbol) {
    if (symbol === sessionState.hostSymbol) {
      return "host";
    }
    if (symbol === sessionState.guestSymbol) {
      return "guest";
    }
    return null;
  }

  function swapSessionSymbols() {
    const nextHostSymbol = sessionState.hostSymbol === "X" ? "O" : "X";
    sessionState.hostSymbol = nextHostSymbol;
    sessionState.guestSymbol = nextHostSymbol === "X" ? "O" : "X";
    updatePlayerSymbol();
  }

  function resetGame({
    announce = true,
    sessionOverride = null,
    toggleSymbols = false,
  } = {}) {
    if (sessionOverride) {
      applySessionState(sessionOverride);
    } else if (toggleSymbols) {
      swapSessionSymbols();
    }
    gameState.board = Array(9).fill(null);
    gameState.currentTurn = "X";
    gameState.winner = null;
    gameState.roundComplete = false;
    updatePlayerSymbol();
    updateBoardUI();
    if (announce) {
      outbound({ type: "reset", session: sessionState });
    }
  }

  function handleRemotePayload(payload) {
    switch (payload.type) {
      case "move":
        playMove(payload.index, payload.symbol, false);
        break;
      case "reset":
        resetGame({ announce: false, sessionOverride: payload.session });
        break;
      case "roundComplete":
        if (payload.session) {
          applySessionState(payload.session);
        }
        gameState.roundComplete = true;
        gameState.winner = payload.outcome?.winner ?? null;
        updateBoardUI();
        updateRoundActionButton();
        break;
      case "sync":
        applySyncState(payload.state);
        break;
      default:
        break;
    }
  }

  function applySyncState(state) {
    if (!state) return;
    gameState.board = state.board ?? Array(9).fill(null);
    gameState.currentTurn = state.currentTurn ?? "X";
    gameState.winner = state.winner ?? null;
    gameState.roundComplete = Boolean(state.roundComplete);
    applySessionState(state.session ?? sessionState);
    updateBoardUI();
  }

  function sendSyncState() {
    outbound({
      type: "sync",
      state: {
        board: gameState.board,
        currentTurn: gameState.currentTurn,
        winner: gameState.winner,
        roundComplete: gameState.roundComplete,
        session: sessionState,
      },
    });
  }

  function resetSession() {
    currentRole = null;
    initializeSessionState();
    resetGame({ announce: false });
    updateScoreboardUI();
  }

  function initBoard() {
    boardEl.innerHTML = "";
    gameState.board.forEach((_, index) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.cell = String(index);
      cell.addEventListener("click", () => handleCellClick(index));
      boardEl.appendChild(cell);
    });
  }

  function init() {
    initBoard();
    resetGame({ announce: false });
    updateRoundActionButton();
    resetGameBtn.addEventListener("click", () => {
      const shouldToggle = gameState.roundComplete;
      resetGame({ announce: true, toggleSymbols: shouldToggle });
    });
  }

  function checkWinner() {
    for (const [a, b, c] of winPatterns) {
      if (!gameState.board[a]) continue;
      if (
        gameState.board[a] === gameState.board[b] &&
        gameState.board[a] === gameState.board[c]
      ) {
        return gameState.board[a];
      }
    }
    return null;
  }

  return {
    init,
    resetGame,
    resetSession,
    setRole,
    setConnectionState,
    handleRemotePayload,
    sendSyncState,
    setOutboundHandler,
    initializeSessionState,
    applySyncState,
    updateScoreboardUI,
  };
}
