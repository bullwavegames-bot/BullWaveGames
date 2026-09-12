# Playable collection

The catalog contains the six original games plus thirty new browser games. The landing-page category tabs link to playable game details. Every published game is free to launch; membership remains available for optional perks.

## Running

- `npm run dev`: site and room service on the same Vite server (default port 5173).
- `npm run build`: TypeScript validation and production assets.
- `npm run preview`: serves built assets and the room service for local preview.
- `npm run test:games`: rule, component-control, and two-client room tests.

For friends on the same trusted local network, run the dev server with `--host 0.0.0.0`, open its printed Network address on every device, and share a room code. `localhost` on another device refers to that other device. Public multiplayer hosting needs a persistent Node/WebSocket host or an equivalent room service; static hosting alone does not run `frontend/server/rooms.mjs`. No public hosting was configured by this change.

## Modes and deliberately compact rules

- Klondike: draw-one, seven columns, alternating-color descending tableau, suited ascending foundations, recycle stock, undo.
- Spider: one suit, ten columns, eight complete king-to-ace runs; deal only with no empty columns.
- Rummy: ten-card, two-player meld variant against a basic computer. Aces low; no jokers, money, wagers, or Indian 13-card declaration rules.
- Ludo: forty shared track squares, four home steps, four tokens per player; six to enter and repeat, exact finish, safe start squares. Local mode uses two players; rooms support two to four. This compact board does not implement blockade or three-sixes variants.
- Chess: chess.js validates moves, castling, en passant, promotion, mate and draws. Choose a basic capture-preferring computer or same-device opponent before moving.
- Carrom: solo pocket-all practice; queen counts as a coin with no cover rule. Pointer drag sets shot direction and force.
- Sudoku: uniquely solvable 9×9 puzzle with randomized digit mapping, notes, and mistake checking.
- 2048, word guess, match-3, memory matching, crossword, and picture assembly have distinct rules and completion states. Crossword is a compact five-clue puzzle. Picture assembly uses swap-any-two square tiles. Word guess uses a bundled finite English dictionary.
- Snake is a bounded single-player arena. Blob Arena uses roaming computer rivals. Runner uses three lanes; Racing Rush is a 60-second traffic-dodging challenge. These are original compact variants, not embedded copies of commercial games.
- Tower Defense: five waves and eight build pads. Bubble Shooter: five colors, cluster popping, disconnected drops, new rows after five misses.
- General, sports, and movie trivia use curated shuffled ten-question sets.
- City and business progress save in this browser only. City income runs while the game is open and unpaused; there is no offline-income simulation. Business days advance manually.
- Territory strategy is a twelve-territory, dice-combat variant against a basic computer.

## Shared rooms

Draw & Guess, Multiplayer Ludo, Live Trivia Contest, and Trivia Battle use a same-origin WebSocket endpoint at `/rooms`. At least two players are required. The host starts the game; shared games cannot pause. Draw & Guess rotates the drawer for two rounds per player. Quiz rooms have ten synchronized questions, 20 seconds each and 4-second reveals; correct answers earn 100 points. Trivia Battle optionally totals Blue and Gold team scores.

Room state is authoritative on the server: it validates Ludo turns and moves, supplies dice rolls, withholds secret drawing words and quiz answers from other players, and ignores duplicate quiz answers. A disconnect ends the current match for remaining players, who may restart with at least two players. There is no reconnect/resume guarantee or global weekly leaderboard. Rooms, chat, drawings, and scores are in memory and disappear on server restart. Room scores are not submitted as solo personal-best results.

The service is intended for this local prototype, not production infrastructure. It has room/player/payload/rate limits and same-origin checks, but no durable storage, account authentication for rooms, moderation service, or production deployment configuration.

## Validation

Automated tests cover 30 initial game renders, category counts and unique slugs, representative puzzle/card rules, Ludo capture/turn/finish rules, chess mate/castling, 26 solo control mounts and timer cleanup, selected completion flows and saves, and two-client tests for all four room modes. Browser visual/playthrough QA has not been performed; canvas tests use a mocked drawing context and verify control/lifecycle execution rather than rendered pixels.
