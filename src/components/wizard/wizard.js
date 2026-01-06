const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const SHARE_QUERY_KEY = "offer";

export function createWizardApp(dom, { gameManager, log }) {
  const {
    statusText,
    steps,
    roleViews,
    connectionTitle,
    connectionSummary,
    hostOfferSdpEl,
    hostAnswerSdpEl,
    guestOfferSdpEl,
    guestAnswerSdpEl,
    hostCopyOfferBtn,
    hostSharedOfferBtn,
    hostShowOfferAgainBtn,
    guestAnswerButton,
    guestCopyAnswerButton,
    finalizeBtn,
    backToRoleBtn,
    endSessionBtn,
    hostShareCard,
    hostAwaitCard,
    guestAnswerCard,
    logEl,
  } = dom;

  const wizardState = {
    role: null,
    step: 1,
    hostPhase: "share",
  };

  let pc = null;
  let dataChannel = null;
  let isOfferer = false;

  function logMessage(message) {
    if (typeof log === "function") {
      log(message);
      return;
    }
    const timestamp = new Date().toLocaleTimeString();
    logEl.textContent =
      `[${timestamp}] ${message}\n` + logEl.textContent.slice(0, 1500);
  }

  function setStatus(text, variant = "") {
    statusText.textContent = text;
    statusText.classList.remove("ready", "error");
    if (variant) {
      statusText.classList.add(variant);
    }
  }

  function goToStep(step) {
    wizardState.step = step;
    steps.forEach((section) => {
      const sectionStep = Number(section.dataset.step);
      section.classList.toggle("active", sectionStep === step);
    });
  }

  function toggleRoleViews(role) {
    roleViews.forEach((element) => {
      const visibleFor = element.dataset.roleVisible;
      if (!visibleFor) {
        return;
      }
      element.classList.toggle("hidden", role !== visibleFor);
    });
  }

  function configureRoleCopy(role) {
    if (!role) {
      connectionTitle.textContent = "Connection setup";
      connectionSummary.textContent =
        'Choose \"Invite a friend\" or \"Accept an invite\" to see step-by-step directions.';
      return;
    }
    if (role === "host") {
      connectionTitle.textContent = "Invite a friend";
      connectionSummary.textContent =
        "We generate an offer automatically. Copy it, share it, then paste the guest answer to finalize.";
    } else {
      connectionTitle.textContent = "Accept an invite";
      connectionSummary.textContent =
        "Paste the host offer, generate an answer, copy it, and send it back so they can finalize.";
    }
  }

  function showHostShareCard() {
    wizardState.hostPhase = "share";
    hostShareCard.classList.remove("hidden");
    hostAwaitCard.classList.add("hidden");
    hostAnswerSdpEl.value = "";
    finalizeBtn.disabled = true;
    const hasOffer = Boolean(hostOfferSdpEl.value.trim());
    hostCopyOfferBtn.disabled = !hasOffer;
    hostSharedOfferBtn.disabled = !hasOffer;
  }

  function showHostAwaitCard() {
    wizardState.hostPhase = "awaitAnswer";
    hostShareCard.classList.add("hidden");
    hostAwaitCard.classList.remove("hidden");
    hostAnswerSdpEl.focus();
    updateFinalizeAvailability();
  }

  function toggleGuestAnswerCard(show) {
    if (show) {
      guestAnswerCard.classList.remove("hidden");
      guestCopyAnswerButton.disabled = false;
    } else {
      guestAnswerCard.classList.add("hidden");
      guestAnswerSdpEl.value = "";
      guestCopyAnswerButton.disabled = true;
    }
  }

  function selectRole(role) {
    wizardState.role = role;
    isOfferer = role === "host";
    gameManager.setRole(role);
    toggleRoleViews(role);
    configureRoleCopy(role);
    clearLog();
    gameManager.resetGame({ announce: false });
    if (role === "host") {
      hostOfferSdpEl.placeholder = "Generating offer...";
      hostCopyOfferBtn.disabled = true;
      hostSharedOfferBtn.disabled = true;
      showHostShareCard();
      setStatus("Generating offer...");
      createOffer();
    } else {
      guestOfferSdpEl.value = "";
      toggleGuestAnswerCard(false);
      setStatus('Paste the host offer and click \"Generate answer\".');
    }
    goToStep(2);
  }

  function clearLog() {
    if (logEl) {
      logEl.textContent = "";
    }
  }

  function returnToRoleSelection() {
    wizardState.role = null;
    isOfferer = false;
    toggleRoleViews(null);
    configureRoleCopy(null);
    clearLog();
    hostOfferSdpEl.value = "";
    hostAnswerSdpEl.value = "";
    guestOfferSdpEl.value = "";
    guestAnswerSdpEl.value = "";
    showHostShareCard();
    toggleGuestAnswerCard(false);
    hostCopyOfferBtn.disabled = true;
    hostSharedOfferBtn.disabled = true;
    setStatus("Waiting for action...");
    gameManager.resetSession();
    closePeerConnection();
    goToStep(1);
  }

  function closePeerConnection() {
    if (pc) {
      try {
        pc.close();
      } catch (error) {
        console.error(error);
      }
      pc = null;
    }
    if (dataChannel) {
      try {
        dataChannel.close();
      } catch (error) {
        console.error(error);
      }
      dataChannel = null;
    }
    gameManager.setConnectionState(false);
  }

  function ensureRole(requiredRole) {
    if (wizardState.role !== requiredRole) {
      setStatus(
        requiredRole === "host"
          ? 'Choose \"Invite a friend\" first.'
          : 'Choose \"Accept an invite\" first.',
        "error",
      );
      return false;
    }
    return true;
  }

  function resetPeerConnection({ createDataChannel = false } = {}) {
    closePeerConnection();
    pc = new RTCPeerConnection(config);
    pc.oniceconnectionstatechange = () => {
      logMessage(`ICE state: ${pc.iceConnectionState}`);
    };
    pc.onconnectionstatechange = () => {
      logMessage(`Connection state: ${pc.connectionState}`);
      if (pc.connectionState === "failed") {
        setStatus(
          "Connection failed. Try resetting and starting again.",
          "error",
        );
        closePeerConnection();
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
        if (wizardState.role === "host") {
          hostOfferSdpEl.value = JSON.stringify(pc.localDescription);
        } else {
          guestAnswerSdpEl.value = JSON.stringify(pc.localDescription);
        }
      }
    };
    pc.ondatachannel = (event) => {
      logMessage("Received data channel from remote peer");
      attachDataChannel(event.channel);
    };

    if (createDataChannel) {
      const channel = pc.createDataChannel("ttt-data", { ordered: true });
      attachDataChannel(channel);
    }
  }

  function attachDataChannel(channel) {
    dataChannel = channel;
    dataChannel.onopen = () => {
      logMessage("Data channel open");
      gameManager.setConnectionState(true);
      setStatus("Connected! Start playing.", "ready");
      gameManager.sendSyncState();
      goToStep(3);
    };
    dataChannel.onclose = () => {
      logMessage("Data channel closed");
      setStatus("Connection closed", "error");
      gameManager.setConnectionState(false);
      if (wizardState.role) {
        goToStep(2);
      }
    };
    dataChannel.onerror = (event) => {
      console.error(event);
      logMessage("Data channel error");
    };
    dataChannel.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        gameManager.handleRemotePayload(payload);
      } catch (error) {
        console.error("Failed to parse message", error);
      }
    };
  }

  function sendMessage(payload) {
    if (!dataChannel || dataChannel.readyState !== "open") {
      return;
    }
    dataChannel.send(JSON.stringify(payload));
  }

  function copyTextToClipboard(text) {
    if (!text) {
      return Promise.resolve(false);
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard
        .writeText(text)
        .then(() => {
          logMessage("Copied to clipboard");
          return true;
        })
        .catch(() => fallbackCopyText(text));
    }
    return Promise.resolve(fallbackCopyText(text));
  }

  function fallbackCopyText(text) {
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.setAttribute("readonly", "");
    temp.style.position = "fixed";
    temp.style.top = "-1000px";
    document.body.appendChild(temp);
    temp.select();
    temp.setSelectionRange(0, temp.value.length);
    let succeeded = false;
    try {
      succeeded = document.execCommand("copy");
    } catch (error) {
      console.error("execCommand copy failed", error);
    }
    document.body.removeChild(temp);
    if (succeeded) {
      logMessage("Copied to clipboard");
    } else {
      logMessage("Clipboard copy failed");
    }
    return succeeded;
  }

  async function createOffer() {
    if (!ensureRole("host")) {
      return;
    }
    isOfferer = true;
    resetPeerConnection({ createDataChannel: true });
    hostAnswerSdpEl.value = "";
    gameManager.resetGame({ announce: false });
    setStatus("Generating offer...");
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);
      hostOfferSdpEl.value = JSON.stringify(pc.localDescription);
      hostCopyOfferBtn.disabled = false;
      hostSharedOfferBtn.disabled = false;
      hostOfferSdpEl.placeholder = "Copy and share this text.";
      setStatus(
        'Copy the offer or tap \"Share link\", then wait for the guest to respond.',
      );
      logMessage("Offer ready. Send it to the other player.");
    } catch (error) {
      console.error(error);
      setStatus("Failed to create offer", "error");
    }
  }

  async function answerAndConnect() {
    if (!ensureRole("guest")) {
      return null;
    }
    const raw = guestOfferSdpEl.value;
    const remoteDescription = raw.trim();
    if (!remoteDescription) {
      setStatus("Paste the remote offer first.", "error");
      return null;
    }
    try {
      const offer = JSON.parse(remoteDescription);
      isOfferer = false;
      resetPeerConnection({ createDataChannel: false });
      guestOfferSdpEl.value = raw;
      guestAnswerSdpEl.value = "";
      gameManager.resetGame({ announce: false });
      setStatus("Connecting... setting remote offer.");
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(pc);
      const description = JSON.stringify(pc.localDescription);
      guestAnswerSdpEl.value = description;
      toggleGuestAnswerCard(true);
      logMessage("Answer created. Send it back to finish setup.");
      setStatus('Answer ready. Use \"Copy answer\" and send it to the host.');
      return description;
    } catch (error) {
      console.error(error);
      setStatus(
        "Could not process offer. Check the text and try again.",
        "error",
      );
      return null;
    }
  }

  async function finalizeConnection() {
    if (!ensureRole("host")) {
      return;
    }
    const remoteDescription = hostAnswerSdpEl.value.trim();
    if (!remoteDescription) {
      setStatus("Paste the answer before finalizing.", "error");
      return;
    }
    if (!pc) {
      setStatus("Create an offer first.", "error");
      return;
    }
    try {
      const answer = JSON.parse(remoteDescription);
      await pc.setRemoteDescription(answer);
      setStatus("Waiting for data channel to open...");
      hostAnswerSdpEl.value = "";
      updateFinalizeAvailability();
      logMessage("Remote answer set. Waiting for channel.");
    } catch (error) {
      console.error(error);
      setStatus("Failed to apply remote answer.", "error");
    }
  }

  function updateFinalizeAvailability() {
    const hasText = Boolean(hostAnswerSdpEl.value.trim());
    finalizeBtn.disabled = !hasText;
  }

  function handleShareLink() {
    const offer = hostOfferSdpEl.value.trim();
    if (!offer) {
      setStatus("Offer not ready yet. Wait a second and try again.", "error");
      return;
    }
    const shareUrl = buildShareUrl(offer);
    if (navigator.share) {
      navigator
        .share({
          title: "WebRTC Tic-Tac-Toe invite",
          text: "Join my tic-tac-toe match via WebRTC.",
          url: shareUrl,
        })
        .then(() => {
          logMessage("Shared invite link via Web Share API");
          showHostAwaitCard();
          setStatus(
            "Shared the invite! Paste your friend's answer when it arrives.",
          );
        })
        .catch(() => {
          copyShareLink(shareUrl);
        });
    } else {
      copyShareLink(shareUrl);
    }
  }

  async function copyShareLink(url) {
    const copied = await copyTextToClipboard(url);
    if (copied) {
      setStatus(
        "Share link copied! Send it to your friend and wait for their answer.",
      );
      showHostAwaitCard();
    } else {
      setStatus(
        "Could not copy the share link. Copy it manually from the page.",
        "error",
      );
    }
  }

  function buildShareUrl(offerText) {
    const url = new URL(window.location.href);
    url.searchParams.set(SHARE_QUERY_KEY, offerText);
    return url.toString();
  }

  function setupEventListeners() {
    hostCopyOfferBtn.addEventListener("click", async () => {
      const copied = await copyTextToClipboard(hostOfferSdpEl.value);
      if (copied) {
        showHostAwaitCard();
        setStatus("Offer copied! Waiting for your friend's answer.");
      } else {
        setStatus(
          "Copy failed. Try again once the offer finishes generating.",
          "error",
        );
      }
    });
    hostSharedOfferBtn.addEventListener("click", () => {
      handleShareLink();
    });
    hostShowOfferAgainBtn.addEventListener("click", () => {
      showHostShareCard();
      setStatus("Copy and share your offer again if needed.");
    });
    hostAnswerSdpEl.addEventListener("input", () =>
      updateFinalizeAvailability(),
    );
    finalizeBtn.addEventListener("click", () => finalizeConnection());
    guestAnswerButton.addEventListener("click", async () => {
      if (!guestOfferSdpEl.value.trim()) {
        setStatus("Paste the host offer first.", "error");
        return;
      }
      guestAnswerButton.disabled = true;
      try {
        await answerAndConnect();
      } finally {
        guestAnswerButton.disabled = false;
      }
    });
    guestCopyAnswerButton.addEventListener("click", async () => {
      const copied = await copyTextToClipboard(guestAnswerSdpEl.value);
      if (copied) {
        setStatus("Answer copied! Share it with the host.");
      } else {
        setStatus("Copy failed. Try again after focusing the page.", "error");
      }
    });
    backToRoleBtn.addEventListener("click", () => returnToRoleSelection());
    endSessionBtn.addEventListener("click", () => returnToRoleSelection());
  }

  function prefillOfferFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const sharedOffer = params.get(SHARE_QUERY_KEY);
    if (sharedOffer) {
      selectRole("guest");
      guestOfferSdpEl.value = sharedOffer;
      setStatus(
        'Invite detected. Review the offer and click \"Generate answer\".',
      );
      guestOfferSdpEl.focus();
      try {
        const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || ""}`;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (error) {
        console.warn("Unable to clean URL params", error);
      }
    }
  }

  async function waitForIceGathering(connection) {
    if (connection.iceGatheringState === "complete") {
      return;
    }
    await new Promise((resolve) => {
      const checkState = () => {
        if (connection.iceGatheringState === "complete") {
          connection.removeEventListener("icegatheringstatechange", checkState);
          resolve();
        }
      };
      connection.addEventListener("icegatheringstatechange", checkState);
    });
  }

  function init() {
    gameManager.setOutboundHandler((payload) => sendMessage(payload));
    setupEventListeners();
    showHostShareCard();
    toggleGuestAnswerCard(false);
    goToStep(1);
    setStatus("Waiting for action...");
    window.addEventListener("beforeunload", () => closePeerConnection());
  }

  init();

  return {
    selectRole,
    prefillOfferFromUrl,
    returnToRoleSelection,
  };
}
