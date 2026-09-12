# Bullwave Games

Premium browser arcade studio site for **BULL WAVE CLUB**.

Play original browser games. Membership unlocks the studio.

The repo is split into two packages:

- `frontend/` — Vite + React app (Vercel)
- `backend/` — Fastify API (Render)

Ludo and trivia rules live in both `frontend/shared` and `backend/shared`. Change them together.

## Run locally

```bash
npm install --prefix frontend
npm install --prefix backend
npm run backend
npm run dev
```

Open http://localhost:5173

Frontend env: `frontend/.env` (copy `frontend/.env.example`).  
API env: `backend/.env` (copy `backend/.env.example`).

## Deploy

- **Frontend (Vercel):** Root Directory `frontend`, build `npm run build`, output `dist`. Set `VITE_API_URL` to the Render API origin.
- **API (Render):** Root Directory `backend`. Do not deploy the Vite app as the API.

## Prototype operations login

Documented in `docs/IMPLEMENTATION.md`. Not shown in the public interface.

## Boundaries

This is not a gambling product. There are no bets, wallets, coin packs, cash prizes, or casino games.
