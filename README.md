# Liquidity PO3

AI chart scanner using ICT/PO3 concepts, with a built-in risk filter (flags any setup below 1:2 R:R or outside London/NY AM killzones).

## How it's structured
- `src/` — the website (React + Vite)
- `api/scan.js` — a serverless function that calls the Gemini AI API. Your API key lives here, on the server, never in the browser.

Because you own the API key and only pay the AI provider directly, there's no third-party scan limit like Lovable/Base44 impose.

## Deploy it (no local setup needed)

1. **Get a free Gemini API key** — go to aistudio.google.com → "Get API key" → create one. Free tier is generous for this use case.
2. **Put this project on GitHub** — create a new repo and upload this folder (GitHub's web upload works fine, no command line needed).
3. **Deploy on Vercel**:
   - Go to vercel.com → sign in with GitHub → "Add New Project" → pick this repo.
   - Vercel auto-detects it's a Vite app — leave the defaults.
   - Before clicking Deploy, open **Environment Variables** and add:
     - Name: `GEMINI_API_KEY`
     - Value: (the key from step 1)
   - Click **Deploy**.
4. You'll get a live URL like `liquidity-po3.vercel.app` — that's your published site. Share it, or later connect a custom domain in Vercel's project settings.

## Running it locally (optional)
```
npm install
npm run dev
```
Note: `npm run dev` won't run the `/api/scan` function locally unless you use `vercel dev` instead of `vite dev`. For local testing with the API working: `npm i -g vercel`, then `vercel dev`.
