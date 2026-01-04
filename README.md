# WebRTC Tic-Tac-Toe

A static, GitHub Pages-ready WebRTC experiment that lets two people play tic-tac-toe directly between their browsers using a data channel. There is no backend server; you only exchange the generated WebRTC Session Description (SDP) text manually through chat/email/etc.

## Features

- Pure client-side app (HTML/CSS/JS) suitable for GitHub Pages or any static host
- WebRTC peer-to-peer connection using a data channel for instant move syncing
- Manual signaling flow so you do not need to run a signaling server
- Responsive, modern UI with clipboard helpers and live connection logs

## Getting started

1. Clone or download this repo.
2. Serve the files locally (for example `python3 -m http.server`) or just open `index.html` in a browser.
3. Follow the in-app instructions to exchange the SDP text with your opponent:
   - Player A clicks **Create Offer** and shares the text that appears under “Share your SDP”.
   - Player B pastes that offer into “Remote SDP” and clicks **Answer & Connect**, then sends the generated answer back.
   - Player A pastes the answer and clicks **Finalize Connection**. When the status shows “Connected”, start playing.

The SDP blobs can be sent via chat, email, QR code, etc. A new pair of blobs is needed for each new match or if either player refreshes the page.

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. In your GitHub repo settings, open **Pages** and choose the `main` branch with the root folder. Save the settings.
3. GitHub Pages will build the static site and publish it at `https://<username>.github.io/<repo-name>/`.

Once deployed, share the URL with your friends. They can open the site in any modern browser that supports WebRTC.

## Development notes

- The app uses only public STUN servers (`stun:stun.l.google.com:19302`).
- Because signaling happens manually, the same page works anywhere without extra infrastructure.
- The UI was built to be self-explanatory, but the README doubles as a quick reference for collaborators.
