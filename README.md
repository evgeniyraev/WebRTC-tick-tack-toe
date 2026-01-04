# WebRTC Tic-Tac-Toe

A static, GitHub Pages-ready WebRTC experiment that lets two people play tic-tac-toe directly between their browsers using a data channel. There is no backend server; you only exchange the generated WebRTC Session Description (SDP) text manually through chat/email/etc.

## Features

- Pure client-side app (HTML/CSS/JS) suitable for GitHub Pages or any static host
- WebRTC peer-to-peer connection using a data channel for instant move syncing
- Manual signaling flow so you do not need to run a signaling server
- Responsive, modern UI with clipboard helpers and live connection logs
- Three-step wizard that guides each player (host or guest) through the exact actions they need
- Scoreboard with automatic role swapping so the host and guest alternate playing as X/O each round

## Getting started

1. Clone or download this repo.
2. Serve the files locally (for example `python3 -m http.server`) or just open `index.html` in a browser.
3. Use the built-in wizard:
   - Step 1: Pick **Invite a friend** if you are hosting (you will be player X) or **Accept an invite** if you already received an offer (you will be player O).
   - Step 2: Follow the role-specific prompts - hosts automatically get an offer ready to copy/share (or use the Share button to send a link that pre-fills the guest page) before pasting the guest answer, while guests only see "Paste host SDP" plus a single "Copy answer & connect" button that generates and copies their reply.
   - Step 3: The wizard switches to the game board once the WebRTC data channel opens. Each finished round updates the scoreboard and swaps who plays as X/O for the next match.

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
