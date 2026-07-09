# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — runs Express/Socket.io server (`server.js`, port 3001) and Vite dev server (port 5173) concurrently. Vite proxies `/socket.io` to `localhost:3001`.
- `npm run server` — server only.
- `npm run build` — Vite production build to `dist/`.
- `npm run preview` — preview production build.

No test runner or lint config is set up (Playwright is a devDependency but no test files/config exist yet).

## Architecture

Real-time multiplayer Rummikub: Express + Socket.io server holding authoritative game state in memory, React client rendering it.

**Server (`server.js`)** — single file, all game logic. `rooms` is a `Map<code, room>` held in-memory (no persistence/DB — state is lost on server restart). Each `room` holds `players[]`, `board` (array of melds, each an array of tile objects), `deck`, `currentPlayerIndex`, `status` (`waiting`/`playing`/`ended`). Socket event handlers: `create-room`, `join-room`, `start-game`, `play-melds` (play straight from hand), `full-board-play` (rearrange board: remove existing melds by index, recombine with hand tiles into new melds — used for reorganizing the table after the initial meld), `draw-tile`, `play-again`, `update-draft` (broadcasts live drag state to other players so they see opponents' in-progress moves before committing), `leave-room`/`disconnect`.
  - Every state-mutating handler re-validates fully server-side (hand ownership, meld validity via `isValidMeld`, initial-30-point-meld rule, tile availability) — the client is not trusted.
  - After every mutation, `emitRoomUpdate` sends each player a *personalized* view via `buildPublicState` (only that player's own hand is included as `yourHand`; other players only expose `handCount`).
  - Turn passing (`nextPlayer`), win checking (`checkWin`), and deck-exhaustion/lowest-score end condition (tracked via `consecutivePasses`) are centralized helpers.

**Game rules engine (`src/game/rummikubEngine.js`)** — pure functions, framework-agnostic, imported by the server: `createDeck`/`shuffle`/`dealTiles`, `isValidRun`/`isValidGroup`/`isValidMeld` (joker-aware, handles wraparound-free run gaps filled by jokers), `tryReplaceJoker`, `calculateScore`, `generateRoomCode`. This is the single source of truth for what a legal meld is — keep client-side preview logic (in `GameScreen.jsx`) in sync with these semantics but never trust it as authoritative.

**Client (`src/`)** — plain React (no router/state library). `App.jsx` owns the single `roomState` from the server and switches screens purely based on `roomState.status`: `home` → `lobby` → `game` → `end`. `socket.js` exports one shared, not-auto-connecting `socket.io-client` instance.
  - `HomeScreen.jsx` — create/join room form.
  - `LobbyScreen.jsx` — waiting room, host starts game (with difficulty setting, though difficulty currently isn't consumed by any AI/bot logic in `server.js`).
  - `GameScreen.jsx` (largest file, ~1300 lines) — the board/hand UI: drag-and-drop of tiles between hand and board "zones," client-side meld validity preview, turn timer, sound effects, and emits `update-draft` so other players see live in-progress rearrangement before the move is committed via `play-melds`/`full-board-play`.
  - `EndScreen.jsx` — winner/scores, play-again.
  - `motion.js` — shared Framer Motion variants (e.g. `screenTransition`) used for screen transitions in `App.jsx`.
  - Styling is Tailwind (`tailwind.config.js`, `src/index.css`); avatars are static assets in `src/public/`.

## Domain rules

Full Rummikub rules (including worked board-reorganization scenarios) are documented in `RULES.md` (Spanish) — read it before changing meld/board-reorganization logic, since `full-board-play`'s remove-and-recombine model implements exactly the scenarios described there.
