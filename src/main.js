import { createGameManager } from './components/game/game.js';
import { createWizardApp } from './components/wizard/wizard.js';
import { initWelcome } from './components/welcome/welcome.js';

const boardEl = document.getElementById('board');
const playerSymbolEl = document.getElementById('playerSymbol');
const turnIndicatorEl = document.getElementById('turnIndicator');
const resultEl = document.getElementById('result');
const resetGameBtn = document.getElementById('resetGame');
const scoreYouEl = document.getElementById('scoreYou');
const scoreOpponentEl = document.getElementById('scoreOpponent');
const scoreDrawsEl = document.getElementById('scoreDraws');
const scoreYouLabel = document.getElementById('scoreYouLabel');
const scoreOpponentLabel = document.getElementById('scoreOpponentLabel');
const logEl = document.getElementById('log');

const log = (message) => {
  const timestamp = new Date().toLocaleTimeString();
  logEl.textContent = `[${timestamp}] ${message}\n` + logEl.textContent.slice(0, 1500);
};

const gameManager = createGameManager(
  {
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
  },
  { log }
);

gameManager.init();

const wizard = createWizardApp(
  {
    statusText: document.getElementById('statusText'),
    steps: document.querySelectorAll('[data-step]'),
    roleViews: document.querySelectorAll('[data-role-visible]'),
    connectionTitle: document.getElementById('connectionTitle'),
    connectionSummary: document.getElementById('connectionSummary'),
    hostOfferSdpEl: document.getElementById('hostOfferSdp'),
    hostAnswerSdpEl: document.getElementById('hostAnswerSdp'),
    guestOfferSdpEl: document.getElementById('guestOfferSdp'),
    guestAnswerSdpEl: document.getElementById('guestAnswerSdp'),
    hostCopyOfferBtn: document.getElementById('hostCopyOffer'),
    hostSharedOfferBtn: document.getElementById('hostSharedOffer'),
    hostShowOfferAgainBtn: document.getElementById('hostShowOfferAgain'),
    guestAnswerButton: document.getElementById('guestAnswerButton'),
    guestCopyAnswerButton: document.getElementById('guestCopyAnswerButton'),
    finalizeBtn: document.getElementById('finalizeConnection'),
    backToRoleBtn: document.getElementById('backToRole'),
    endSessionBtn: document.getElementById('endSession'),
    hostShareCard: document.getElementById('hostShareCard'),
    hostAwaitCard: document.getElementById('hostAwaitCard'),
    guestAnswerCard: document.getElementById('guestAnswerCard'),
    logEl,
  },
  { gameManager, log }
);

initWelcome({
  roleButtons: document.querySelectorAll('[data-role-select]'),
  onRoleSelect: (role) => wizard.selectRole(role),
});

wizard.prefillOfferFromUrl();
