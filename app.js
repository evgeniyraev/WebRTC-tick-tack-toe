const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};
const SHARE_QUERY_KEY = 'offer';

let pc = null;
let dataChannel = null;
let isOfferer = false;

const hostOfferSdpEl = document.getElementById('hostOfferSdp');
const hostAnswerSdpEl = document.getElementById('hostAnswerSdp');
const guestOfferSdpEl = document.getElementById('guestOfferSdp');
const guestAnswerSdpEl = document.getElementById('guestAnswerSdp');
const hostCopyOfferBtn = document.getElementById('hostCopyOffer');
const hostSharedOfferBtn = document.getElementById('hostSharedOffer');
const hostShowOfferAgainBtn = document.getElementById('hostShowOfferAgain');
const guestAnswerButton = document.getElementById('guestAnswerButton');
const guestCopyAnswerButton = document.getElementById('guestCopyAnswerButton');
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
const scoreYouEl = document.getElementById('scoreYou');
const scoreOpponentEl = document.getElementById('scoreOpponent');
const scoreDrawsEl = document.getElementById('scoreDraws');
const scoreYouLabel = document.getElementById('scoreYouLabel');
const scoreOpponentLabel = document.getElementById('scoreOpponentLabel');
const hostShareCard = document.getElementById('hostShareCard');
const hostAwaitCard = document.getElementById('hostAwaitCard');
const guestAnswerCard = document.getElementById('guestAnswerCard');

const wizardState = {
  role: null,
  step: 1,
  hostPhase: 'share',
};

const roleCopy = {
  host: {
    title: 'Invite a friend',
    summary: 'We generate an offer automatically. Copy it, share it, then paste their answer to finalize.',
  },
  guest: {
    title: 'Accept an invite',
    summary: 'Paste the host offer, click the button to answer (it copies for you), then share it back.',
  },
};

function clearSdpFields() {
  hostOfferSdpEl.value = '';
  hostAnswerSdpEl.value = '';
  guestOfferSdpEl.value = '';
  guestAnswerSdpEl.value = '';
}

function setLocalSdpValue(value = '') {
  if (wizardState.role === 'host') {
    hostOfferSdpEl.value = value;
  } else if (wizardState.role === 'guest') {
    guestAnswerSdpEl.value = value;
  }
}

function getLocalSdpValue() {
  if (wizardState.role === 'host') {
    return hostOfferSdpEl.value.trim();
  }
  if (wizardState.role === 'guest') {
    return guestAnswerSdpEl.value.trim();
  }
  return '';
}

function setRemoteSdpValue(value = '') {
  if (wizardState.role === 'host') {
    hostAnswerSdpEl.value = value;
  } else if (wizardState.role === 'guest') {
    guestOfferSdpEl.value = value;
  }
}

function getRemoteSdpValue() {
  if (wizardState.role === 'host') {
    return hostAnswerSdpEl.value.trim();
  }
  if (wizardState.role === 'guest') {
    return guestOfferSdpEl.value.trim();
  }
  return '';
}

const sessionState = {
  hostSymbol: 'X',
  guestSymbol: 'O',
  scoreboard: {
    host: 0,
    guest: 0,
    draws: 0,
  },
};

const gameState = {
  board: Array(9).fill(null),
  currentTurn: 'X',
  playerSymbol: null,
  winner: null,
  connected: false,
  roundComplete: false,
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
    connectionSummary.textContent = 'Choose "Invite a friend" or "Accept an invite" to see step-by-step directions.';
    return;
  }
  connectionTitle.textContent = roleCopy[role].title;
  connectionSummary.textContent = roleCopy[role].summary;
}

function showHostShareCard() {
  wizardState.hostPhase = 'share';
  hostShareCard.classList.remove('hidden');
  hostAwaitCard.classList.add('hidden');
  if (wizardState.role === 'host') {
    setRemoteSdpValue('');
  } else {
    hostAnswerSdpEl.value = '';
  }
  finalizeBtn.disabled = true;
  const hasOffer = Boolean(hostOfferSdpEl.value.trim());
  hostCopyOfferBtn.disabled = !hasOffer;
  hostSharedOfferBtn.disabled = !hasOffer;
  updateFinalizeAvailability();
}

function showHostAwaitCard() {
  wizardState.hostPhase = 'awaitAnswer';
  hostShareCard.classList.add('hidden');
  hostAwaitCard.classList.remove('hidden');
  hostAnswerSdpEl.focus();
  updateFinalizeAvailability();
}

function toggleGuestAnswerCard(show) {
  if (show) {
    guestAnswerCard.classList.remove('hidden');
    guestCopyAnswerButton.disabled = false;
  } else {
    guestAnswerCard.classList.add('hidden');
    guestAnswerSdpEl.value = '';
    guestCopyAnswerButton.disabled = true;
  }
}

function initializeSessionState() {
  sessionState.hostSymbol = 'X';
  sessionState.guestSymbol = 'O';
  sessionState.scoreboard = { host: 0, guest: 0, draws: 0 };
  updateScoreboardUI();
}

function applySessionState(nextState) {
  if (!nextState) {
    return;
  }
  sessionState.hostSymbol = nextState.hostSymbol ?? 'X';
  const guestSymbol = nextState.guestSymbol ?? (sessionState.hostSymbol === 'X' ? 'O' : 'X');
  sessionState.guestSymbol = guestSymbol === sessionState.hostSymbol ? (sessionState.hostSymbol === 'X' ? 'O' : 'X') : guestSymbol;
  sessionState.scoreboard = {
    host: nextState.scoreboard?.host ?? 0,
    guest: nextState.scoreboard?.guest ?? 0,
    draws: nextState.scoreboard?.draws ?? 0,
  };
  updatePlayerSymbol();
  updateScoreboardUI();
}

function selectRole(role) {
  wizardState.role = role;
  isOfferer = role === 'host';
  wizardState.hostPhase = 'share';
  toggleRoleViews(role);
  configureRoleCopy(role);
  updatePlayerSymbol();
  clearSdpFields();
  clearLog();
  resetGame({ announce: false });
  if (role === 'host') {
    hostOfferSdpEl.placeholder = 'Generating offer...';
    hostCopyOfferBtn.disabled = true;
    hostSharedOfferBtn.disabled = true;
    showHostShareCard();
    setStatus('Generating offer...');
    createOffer();
  } else {
    toggleGuestAnswerCard(false);
    setStatus('Paste the host offer and click "Copy answer & connect".');
  }
  goToStep(2);
}

function returnToRoleSelection() {
  wizardState.role = null;
  isOfferer = false;
  toggleRoleViews(null);
  configureRoleCopy(null);
  clearLog();
  clearSdpFields();
  showHostShareCard();
  toggleGuestAnswerCard(false);
  hostCopyOfferBtn.disabled = true;
  hostSharedOfferBtn.disabled = true;
  guestCopyAnswerButton.disabled = true;
  setStatus('Waiting for action...');
  initializeSessionState();
  resetGame({ announce: false });
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
        ? 'Choose "Invite a friend" first.'
        : 'Choose "Accept an invite" first.',
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
  setLocalSdpValue('');
  setRemoteSdpValue('');
  pc = new RTCPeerConnection(config);
  pc.oniceconnectionstatechange = () => {
    log(`ICE state: ${pc.iceConnectionState}`);
  };
  pc.onconnectionstatechange = () => {
    log(`Connection state: ${pc.connectionState}`);
    if (pc.connectionState === 'failed') {
      setStatus('Connection failed. Try resetting and starting again.', 'error');
      teardownDataChannel();
      if (wizardState.role) {
        goToStep(2);
      }
    }
  };
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      return;
    }
    if (pc.localDescription) {
      setLocalSdpValue(JSON.stringify(pc.localDescription));
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
    updateBoardUI();
    updateScoreboardUI();
    sendSyncState();
    goToStep(3);
  };
  dataChannel.onclose = () => {
    log('Data channel closed');
    setStatus('Connection closed', 'error');
    gameState.connected = false;
    if (wizardState.role) {
      goToStep(2);
    }
    updateBoardUI();
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
  setRemoteSdpValue('');
  resetGame({ announce: false });
  setStatus('Generating offer...');
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);
    const description = JSON.stringify(pc.localDescription);
    setLocalSdpValue(description);
    hostCopyOfferBtn.disabled = false;
    hostSharedOfferBtn.disabled = false;
    hostOfferSdpEl.placeholder = 'Copy and share this text.';
    setStatus('Copy and share this offer, then click "I shared it".');
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
  const remoteRaw = guestOfferSdpEl.value;
  const remoteDescription = remoteRaw.trim();
  if (!remoteDescription) {
    setStatus('Paste the remote offer first.', 'error');
    return;
  }
  try {
    const offer = JSON.parse(remoteDescription);
    isOfferer = false;
    resetPeerConnection({ createDataChannel: false });
    guestOfferSdpEl.value = remoteRaw;
    setLocalSdpValue('');
    resetGame({ announce: false });
    setStatus('Connecting... setting remote offer.');
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc);
    const description = JSON.stringify(pc.localDescription);
    setLocalSdpValue(description);
    toggleGuestAnswerCard(true);
    log('Answer created. Send it back to finish setup.');
    const copied = await copyTextToClipboard(description);
    if (copied) {
      setStatus('Answer copied! Share it with the host.');
    } else {
      setStatus('Answer ready. Copy it from the box and share.', 'error');
    }
  } catch (error) {
    console.error(error);
    setStatus('Could not process offer. Check the text and try again.', 'error');
  }
}

async function finalizeConnection() {
  if (!ensureRole('host')) {
    return;
  }
  const remoteDescription = getRemoteSdpValue();
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
    setStatus('Waiting for data channel to open...');
    setRemoteSdpValue('');
    updateFinalizeAvailability();
    log('Remote answer set. Waiting for channel.');
  } catch (error) {
    console.error(error);
    setStatus('Failed to apply remote answer.', 'error');
  }
}

function updatePlayerSymbol() {
  if (!wizardState.role) {
    gameState.playerSymbol = null;
  } else if (wizardState.role === 'host') {
    gameState.playerSymbol = sessionState.hostSymbol;
  } else {
    gameState.playerSymbol = sessionState.guestSymbol;
  }
  playerSymbolEl.textContent = gameState.playerSymbol ?? '-';
}

function updateScoreboardUI() {
  const scoreboard = sessionState.scoreboard;
  if (!wizardState.role) {
    scoreYouLabel.textContent = 'You';
    scoreOpponentLabel.textContent = 'Friend';
    scoreYouEl.textContent = scoreboard.host;
    scoreOpponentEl.textContent = scoreboard.guest;
  } else if (wizardState.role === 'host') {
    scoreYouLabel.textContent = 'You (Host)';
    scoreOpponentLabel.textContent = 'Friend (Guest)';
    scoreYouEl.textContent = scoreboard.host;
    scoreOpponentEl.textContent = scoreboard.guest;
  } else {
    scoreYouLabel.textContent = 'You (Guest)';
    scoreOpponentLabel.textContent = 'Friend (Host)';
    scoreYouEl.textContent = scoreboard.guest;
    scoreOpponentEl.textContent = scoreboard.host;
  }
  scoreDrawsEl.textContent = scoreboard.draws;
}

function updateRoundActionButton() {
  if (!resetGameBtn) return;
  resetGameBtn.textContent = gameState.roundComplete ? 'Start next round' : 'Reset board';
}

function updateBoardUI() {
  for (let i = 0; i < gameState.board.length; i += 1) {
    const cell = document.querySelector(`[data-cell="${i}"]`);
    if (cell) {
      cell.textContent = gameState.board[i] ?? '';
      cell.classList.toggle('filled', Boolean(gameState.board[i]));
    }
  }
  const activeTurn = gameState.connected && !gameState.roundComplete ? gameState.currentTurn : '-';
  turnIndicatorEl.textContent = activeTurn;
  if (gameState.roundComplete) {
    if (gameState.winner) {
      resultEl.textContent = `${gameState.winner} wins!`;
    } else {
      resultEl.textContent = 'Draw!';
    }
  } else if (!gameState.connected) {
    resultEl.textContent = wizardState.role ? 'Waiting for connection' : 'Game not started';
  } else {
    resultEl.textContent = 'Game in progress';
  }
  updateRoundActionButton();
}

function handleCellClick(index) {
  if (!gameState.connected) {
    log('Not connected yet.');
    return;
  }
  if (gameState.roundComplete) {
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
    gameState.currentTurn = symbol === 'X' ? 'O' : 'X';
  }
  updateBoardUI();
  if (isLocal) {
    sendMessage({ type: 'move', index, symbol });
    if (gameState.roundComplete) {
      finalizeRound(
        winner
          ? { winner }
          : { draw: true },
        true
      );
    }
  }
}

function finalizeRound(outcome, initiatedLocally) {
  if (!outcome || !initiatedLocally) {
    return;
  }
  updateScoreboardForOutcome(outcome);
  updateScoreboardUI();
  updateRoundActionButton();
  sendMessage({ type: 'roundComplete', outcome, session: sessionState });
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
    return 'host';
  }
  if (symbol === sessionState.guestSymbol) {
    return 'guest';
  }
  return null;
}

function swapSessionSymbols() {
  const nextHostSymbol = sessionState.hostSymbol === 'X' ? 'O' : 'X';
  sessionState.hostSymbol = nextHostSymbol;
  sessionState.guestSymbol = nextHostSymbol === 'X' ? 'O' : 'X';
  updatePlayerSymbol();
}

function resetGame({ announce = true, sessionOverride = null, toggleSymbols = false } = {}) {
  if (sessionOverride) {
    applySessionState(sessionOverride);
  } else if (toggleSymbols) {
    swapSessionSymbols();
  }
  gameState.board = Array(9).fill(null);
  gameState.currentTurn = 'X';
  gameState.winner = null;
  gameState.roundComplete = false;
  updatePlayerSymbol();
  updateBoardUI();
  updateScoreboardUI();
  if (announce) {
    sendMessage({ type: 'reset', session: sessionState });
  }
}

function handleIncomingMessage(payload) {
  switch (payload.type) {
    case 'move':
      playMove(payload.index, payload.symbol, false);
      break;
    case 'reset':
      resetGame({ announce: false, sessionOverride: payload.session });
      break;
    case 'roundComplete':
      if (payload.session) {
        applySessionState(payload.session);
      }
      gameState.roundComplete = true;
      gameState.winner = payload.outcome?.winner ?? null;
      updateBoardUI();
      updateRoundActionButton();
      break;
    case 'sync':
      syncRemoteState(payload.state);
      break;
    default:
      console.warn('Unknown payload', payload);
  }
}

function syncRemoteState(state) {
  if (!state) return;
  gameState.board = state.board ?? Array(9).fill(null);
  gameState.currentTurn = state.currentTurn ?? 'X';
  gameState.winner = state.winner ?? null;
  gameState.roundComplete = Boolean(state.roundComplete);
  applySessionState(state.session ?? sessionState);
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
      roundComplete: gameState.roundComplete,
      session: sessionState,
    },
  });
}

function sendMessage(payload) {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    return;
  }
  dataChannel.send(JSON.stringify(payload));
}

async function copyTextToClipboard(text) {
  if (!text) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    log('Copied to clipboard');
    return true;
  } catch (error) {
    log('Clipboard copy failed');
    return false;
  }
}

function buildShareUrl(offerText) {
  const url = new URL(window.location.href);
  url.searchParams.set(SHARE_QUERY_KEY, offerText);
  return url.toString();
}

async function shareOfferLink() {
  const offer = hostOfferSdpEl.value.trim();
  if (!offer) {
    setStatus('Offer not ready yet. Wait a second and try again.', 'error');
    return;
  }
  const shareUrl = buildShareUrl(offer);
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'WebRTC Tic-Tac-Toe invite',
        text: 'Join my tic-tac-toe match via WebRTC.',
        url: shareUrl,
      });
      log('Shared invite link via Web Share API');
      showHostAwaitCard();
      setStatus("Shared the invite! Paste your friend's answer when it arrives.");
      return;
    } catch (error) {
      log('Share canceled or failed');
    }
  }
  const copied = await copyTextToClipboard(shareUrl);
  if (copied) {
    setStatus('Share link copied! Send it to your friend and wait for their answer.');
    showHostAwaitCard();
  } else {
    setStatus('Could not copy the share link. Copy it manually from the page.', 'error');
  }
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

function setupEventListeners() {
  resetGameBtn.addEventListener('click', () => {
    const shouldToggle = gameState.roundComplete;
    resetGame({ announce: true, toggleSymbols: shouldToggle });
  });
  finalizeBtn.addEventListener('click', () => finalizeConnection());
  hostCopyOfferBtn.addEventListener('click', async () => {
    const copied = await copyTextToClipboard(hostOfferSdpEl.value);
    if (copied) {
      showHostAwaitCard();
      setStatus("Offer copied! Waiting for your friend's answer.");
    } else {
      setStatus('Copy failed. Try again once the offer finishes generating.', 'error');
    }
  });
  hostSharedOfferBtn.addEventListener('click', () => {
    shareOfferLink();
  });
  hostShowOfferAgainBtn.addEventListener('click', () => {
    showHostShareCard();
    setStatus('Copy and share your offer again if needed.');
  });
  hostAnswerSdpEl.addEventListener('input', () => {
    updateFinalizeAvailability();
  });
  guestAnswerButton.addEventListener('click', async () => {
    if (!guestOfferSdpEl.value.trim()) {
      setStatus('Paste the host offer first.', 'error');
      return;
    }
    guestAnswerButton.disabled = true;
    try {
      await answerAndConnect();
    } finally {
      guestAnswerButton.disabled = false;
    }
  });
  guestCopyAnswerButton.addEventListener('click', async () => {
    await copyTextToClipboard(guestAnswerSdpEl.value);
  });
  roleButtons.forEach((button) => {
    button.addEventListener('click', () => selectRole(button.dataset.roleSelect));
  });
  backToRoleBtn.addEventListener('click', () => returnToRoleSelection());
  endSessionBtn.addEventListener('click', () => returnToRoleSelection());
}

function updateFinalizeAvailability() {
  const hasText = Boolean(hostAnswerSdpEl.value.trim());
  finalizeBtn.disabled = !hasText;
}

function initialSetup() {
  initBoard();
  initializeSessionState();
  resetGame({ announce: false });
  configureRoleCopy(null);
  toggleRoleViews(null);
  updateBoardUI();
  updateScoreboardUI();
  updateRoundActionButton();
  hostCopyOfferBtn.disabled = true;
  hostSharedOfferBtn.disabled = true;
  guestCopyAnswerButton.disabled = true;
  goToStep(1);
  setStatus('Waiting for action...');
}

function prefillOfferFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const sharedOffer = params.get(SHARE_QUERY_KEY);
  if (sharedOffer) {
    selectRole('guest');
    guestOfferSdpEl.value = sharedOffer;
    setStatus('Invite detected. Review the offer and click "Copy answer & connect".');
    guestOfferSdpEl.focus();
    try {
      const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || ''}`;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (error) {
      console.warn('Unable to clean URL params', error);
    }
  }
}

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

setupEventListeners();
initialSetup();
prefillOfferFromUrl();
