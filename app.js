const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

let pc = null;
let dataChannel = null;
let isOfferer = false;

const localSdpEl = document.getElementById('localSdp');
const remoteSdpEl = document.getElementById('remoteSdp');
const createOfferBtn = document.getElementById('createOffer');
const copyLocalBtn = document.getElementById('copyLocal');
const answerBtn = document.getElementById('answerConnect');
const finalizeBtn = document.getElementById('finalizeConnection');
const statusText = document.getElementById('statusText');
const logEl = document.getElementById('log');
const playerSymbolEl = document.getElementById('playerSymbol');
const turnIndicatorEl = document.getElementById('turnIndicator');
const resultEl = document.getElementById('result');
const resetGameBtn = document.getElementById('resetGame');
const boardEl = document.getElementById('board');
const backToRoleBtn = document.getElementById('backToRole');
const endSessionBtn = document.getElementById('endSession');
const roleButtons = document.querySelectorAll('[data-role-select]');
const steps = document.querySelectorAll('[data-step]');
const roleViews = document.querySelectorAll('[data-role-visible]');
const connectionTitle = document.getElementById('connectionTitle');
const connectionSummary = document.getElementById('connectionSummary');

const wizardState = {
  role: null,
  step: 1,
};

const roleCopy = {
  host: {
    title: 'Invite a friend',
    summary: 'Create an offer, send it to your friend, then paste their answer to finalize the WebRTC connection.',
    localPlaceholder: 'Click “Create Offer” to generate the SDP blob to share.',
    remotePlaceholder: 'Paste the answer you received and click “Finalize Connection”.',
  },
  guest: {
    title: 'Accept an invite',
    summary: 'Paste the host offer, generate an answer, send it back, and wait for them to finalize.',
    localPlaceholder: 'After you click “Answer & Connect”, your answer appears here to share back.',
    remotePlaceholder: 'Paste the offer text sent by the host before answering.',
  },
};

const gameState = {
  board: Array(9).fill(null),
  currentTurn: 'X',
  playerSymbol: null,
  winner: null,
  connected: false,
};

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

function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  logEl.textContent = `[${timestamp}] ${message}\n` + logEl.textContent.slice(0, 1500);
}

function clearLog() {
  logEl.textContent = '';
}

function setStatus(text, variant = '') {
  statusText.textContent = text;
  statusText.classList.remove('ready', 'error');
  if (variant) {
    statusText.classList.add(variant);
  }
}

function goToStep(step) {
  wizardState.step = step;
  steps.forEach((section) => {
    const sectionStep = Number(section.dataset.step);
    section.classList.toggle('active', sectionStep === step);
  });
}

function toggleRoleViews(role) {
  roleViews.forEach((element) => {
    const visibleFor = element.dataset.roleVisible;
    if (!visibleFor) {
      return;
    }
    element.classList.toggle('hidden', role !== visibleFor);
  });
}

function configureRoleCopy(role) {
  if (!role || !roleCopy[role]) {
    connectionTitle.textContent = 'Connection setup';
    connectionSummary.textContent = 'Choose “Invite a friend” or “Accept an invite” to see step-by-step directions.';
    localSdpEl.placeholder = 'Choose a role to begin.';
    remoteSdpEl.placeholder = 'Choose a role to begin.';
    return;
  }
  connectionTitle.textContent = roleCopy[role].title;
  connectionSummary.textContent = roleCopy[role].summary;
  localSdpEl.placeholder = roleCopy[role].localPlaceholder;
  remoteSdpEl.placeholder = roleCopy[role].remotePlaceholder;
}

function selectRole(role) {
  wizardState.role = role;
  isOfferer = role === 'host';
  toggleRoleViews(role);
  configureRoleCopy(role);
  gameState.playerSymbol = role === 'host' ? 'X' : 'O';
  updatePlayerSymbol();
  localSdpEl.value = '';
  remoteSdpEl.value = '';
  clearLog();
  resetGame(false);
  setStatus(
    role === 'host'
      ? 'Click “Create Offer” to generate your invite.'
      : 'Paste the host offer and click “Answer & Connect”.'
  );
  goToStep(2);
}

function returnToRoleSelection() {
  wizardState.role = null;
  isOfferer = false;
  toggleRoleViews(null);
  configureRoleCopy(null);
  clearLog();
  localSdpEl.value = '';
  remoteSdpEl.value = '';
  setStatus('Waiting for action…');
  gameState.playerSymbol = null;
  updatePlayerSymbol();
  resetGame(false);
  if (pc) {
    try {
      pc.close();
    } catch (error) {
      console.error(error);
    }
    pc = null;
  }
  teardownDataChannel();
  goToStep(1);
}

function ensureRole(requiredRole) {
  if (wizardState.role !== requiredRole) {
    setStatus(
      requiredRole === 'host'
        ? 'Choose “Invite a friend” first.'
        : 'Choose “Accept an invite” first.',
      'error'
    );
    return false;
  }
  return true;
}

function resetPeerConnection({ createDataChannel = false } = {}) {
  if (pc) {
    try {
      pc.close();
    } catch (error) {
      console.error(error);
    }
  }
  teardownDataChannel();
  localSdpEl.value = '';
  pc = new RTCPeerConnection(config);
  pc.oniceconnectionstatechange = () => {
    log(`ICE state: ${pc.iceConnectionState}`);
  };
  pc.onconnectionstatechange = () => {
    log(`Connection state: ${pc.connectionState}`);
    if (pc.connectionState === 'failed') {
      setStatus('Connection failed. Try resetting and starting again.', 'error');
      teardownDataChannel();
      goToStep(2);
    }
  };
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      return;
    }
    if (pc.localDescription) {
      localSdpEl.value = JSON.stringify(pc.localDescription);
    }
  };
  pc.ondatachannel = (event) => {
    log('Received data channel from remote peer');
    attachDataChannel(event.channel);
  };

  if (createDataChannel) {
    const channel = pc.createDataChannel('ttt-data', { ordered: true });
    attachDataChannel(channel);
  }
}

function attachDataChannel(channel) {
  dataChannel = channel;
  dataChannel.onopen = () => {
    log('Data channel open');
    gameState.connected = true;
    setStatus('Connected! Start playing.', 'ready');
    updatePlayerSymbol();
    sendSyncState();
    if (wizardState.step !== 3) {
      goToStep(3);
    }
  };
  dataChannel.onclose = () => {
    log('Data channel closed');
    setStatus('Connection closed', 'error');
    gameState.connected = false;
    if (wizardState.role) {
      goToStep(2);
    }
  };
  dataChannel.onerror = (event) => {
    console.error(event);
    log('Data channel error');
  };
  dataChannel.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      handleIncomingMessage(payload);
    } catch (error) {
      console.error('Failed to parse message', error);
    }
  };
}

function teardownDataChannel() {
  if (dataChannel) {
    try {
      dataChannel.close();
    } catch (error) {
      console.error(error);
    }
  }
  dataChannel = null;
  gameState.connected = false;
}

async function createOffer() {
  if (!ensureRole('host')) {
    return;
  }
  isOfferer = true;
  resetPeerConnection({ createDataChannel: true });
  remoteSdpEl.value = '';
  gameState.playerSymbol = 'X';
  resetGame(false);
  updatePlayerSymbol();
  setStatus('Generating offer…');
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);
    localSdpEl.value = JSON.stringify(pc.localDescription);
    setStatus('Share this offer with your friend.');
    log('Offer ready. Send it to the other player.');
  } catch (error) {
    console.error(error);
    setStatus('Failed to create offer', 'error');
  }
}

async function answerAndConnect() {
  if (!ensureRole('guest')) {
    return;
  }
  const remoteDescription = remoteSdpEl.value.trim();
  if (!remoteDescription) {
    setStatus('Paste the remote offer first.', 'error');
    return;
  }
  try {
    const offer = JSON.parse(remoteDescription);
    isOfferer = false;
    resetPeerConnection({ createDataChannel: false });
    localSdpEl.value = '';
    gameState.playerSymbol = 'O';
    resetGame(false);
    updatePlayerSymbol();
    setStatus('Connecting… setting remote offer.');
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc);
    localSdpEl.value = JSON.stringify(pc.localDescription);
    setStatus('Share this answer back to the host.');
    log('Answer created. Send it back to finish setup.');
  } catch (error) {
    console.error(error);
    setStatus('Could not process offer. Check the text and try again.', 'error');
  }
}

async function finalizeConnection() {
  if (!ensureRole('host')) {
    return;
  }
  const remoteDescription = remoteSdpEl.value.trim();
  if (!remoteDescription) {
    setStatus('Paste the answer before finalizing.', 'error');
    return;
  }
  if (!pc) {
    setStatus('Create an offer first.', 'error');
    return;
  }
  try {
    const answer = JSON.parse(remoteDescription);
    await pc.setRemoteDescription(answer);
    setStatus('Waiting for data channel to open…');
    remoteSdpEl.value = '';
    log('Remote answer set. Waiting for channel.');
  } catch (error) {
    console.error(error);
    setStatus('Failed to apply remote answer.', 'error');
  }
}

function updatePlayerSymbol() {
  playerSymbolEl.textContent = gameState.playerSymbol ?? '–';
}

function updateBoardUI() {
  for (let i = 0; i < gameState.board.length; i += 1) {
    const cell = document.querySelector(`[data-cell="${i}"]`);
    cell.textContent = gameState.board[i] ?? '';
    cell.classList.toggle('filled', Boolean(gameState.board[i]));
  }
  const isActive = gameState.connected && !gameState.winner;
  turnIndicatorEl.textContent = isActive ? gameState.currentTurn : '–';
  if (gameState.winner) {
    resultEl.textContent = `${gameState.winner} wins!`;
  } else if (!gameState.board.includes(null) && gameState.connected) {
    resultEl.textContent = 'Draw!';
  } else if (!gameState.connected) {
    resultEl.textContent = wizardState.role ? 'Waiting for connection' : 'Game not started';
  } else {
    resultEl.textContent = 'Game in progress';
  }
}

function handleCellClick(index) {
  if (!gameState.connected) {
    log('Not connected yet.');
    return;
  }
  if (gameState.winner) {
    return;
  }
  if (gameState.board[index]) {
    return;
  }
  if (gameState.playerSymbol !== gameState.currentTurn) {
    log("It's not your turn yet.");
    return;
  }
  playMove(index, gameState.playerSymbol, true);
}

function playMove(index, symbol, isLocal) {
  if (gameState.board[index] || gameState.winner) {
    return;
  }
  gameState.board[index] = symbol;
  gameState.currentTurn = symbol === 'X' ? 'O' : 'X';
  const winner = checkWinner();
  if (winner) {
    gameState.winner = winner;
  }
  if (!gameState.board.includes(null) && !winner && gameState.connected) {
    resultEl.textContent = 'Draw!';
  }
  updateBoardUI();
  if (isLocal) {
    sendMessage({ type: 'move', index, symbol });
  }
}

function handleIncomingMessage(payload) {
  switch (payload.type) {
    case 'move':
      playMove(payload.index, payload.symbol, false);
      break;
    case 'reset':
      resetGame(false);
      break;
    case 'sync':
      syncRemoteState(payload.state);
      break;
    default:
      console.warn('Unknown payload', payload);
  }
}

function syncRemoteState(state) {
  gameState.board = state.board;
  gameState.currentTurn = state.currentTurn;
  gameState.winner = state.winner;
  gameState.playerSymbol = gameState.playerSymbol ?? (isOfferer ? 'X' : 'O');
  updatePlayerSymbol();
  updateBoardUI();
}

function sendSyncState() {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    return;
  }
  sendMessage({
    type: 'sync',
    state: {
      board: gameState.board,
      currentTurn: gameState.currentTurn,
      winner: gameState.winner,
    },
  });
}

function sendMessage(payload) {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    return;
  }
  dataChannel.send(JSON.stringify(payload));
}

function checkWinner() {
  for (const [a, b, c] of winPatterns) {
    if (!gameState.board[a]) continue;
    if (gameState.board[a] === gameState.board[b] && gameState.board[a] === gameState.board[c]) {
      return gameState.board[a];
    }
  }
  return null;
}

function resetGame(announce = true) {
  gameState.board = Array(9).fill(null);
  gameState.currentTurn = 'X';
  gameState.winner = null;
  updateBoardUI();
  if (announce) {
    sendMessage({ type: 'reset' });
  }
}

function initBoard() {
  boardEl.innerHTML = '';
  gameState.board.forEach((_, index) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.cell = String(index);
    cell.addEventListener('click', () => handleCellClick(index));
    boardEl.appendChild(cell);
  });
}

initBoard();
resetGame(false);
configureRoleCopy(null);
toggleRoleViews(null);

resetGameBtn.addEventListener('click', () => resetGame(true));
createOfferBtn.addEventListener('click', () => createOffer());
answerBtn.addEventListener('click', () => answerAndConnect());
finalizeBtn.addEventListener('click', () => finalizeConnection());
copyLocalBtn.addEventListener('click', async () => {
  if (!localSdpEl.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(localSdpEl.value);
    log('Copied to clipboard');
  } catch (error) {
    log('Clipboard copy failed');
  }
});
roleButtons.forEach((button) => {
  button.addEventListener('click', () => selectRole(button.dataset.roleSelect));
});
backToRoleBtn.addEventListener('click', () => returnToRoleSelection());
endSessionBtn.addEventListener('click', () => returnToRoleSelection());

goToStep(1);
setStatus('Waiting for action…');

async function waitForIceGathering(connection) {
  if (connection.iceGatheringState === 'complete') {
    return;
  }
  await new Promise((resolve) => {
    const checkState = () => {
      if (connection.iceGatheringState === 'complete') {
        connection.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }
    };
    connection.addEventListener('icegatheringstatechange', checkState);
  });
}

window.addEventListener('beforeunload', () => {
  if (pc) {
    pc.close();
  }
  teardownDataChannel();
});
