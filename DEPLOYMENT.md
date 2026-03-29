# TrustBridge Backend — Deployment Guide

## Current Status

The backend runs in **DEMO mode** — all on-chain operations are simulated in-memory.
This means the frontend can integrate immediately without waiting for IOTA contract deployment.

When contracts are deployed on IOTA testnet, set `PACKAGE_ID` in the environment to switch to **LIVE mode**.

---

## Option 1: Deploy to Render.com (Recommended for Hackathon)

Render gives you a free HTTPS URL that GitHub Pages can call directly (no CORS issues).

### Steps:

1. **Push the backend to a GitHub repo**:
   ```bash
   cd backend
   git init
   git add -A
   git commit -m "TrustBridge backend — demo mode"
   gh repo create trustbridge-backend --public --source=. --push
   ```

2. **Go to https://render.com** → New → Web Service → Connect your repo

3. **Settings**:
   - Build Command: `npm install && npx tsc`
   - Start Command: `node dist/index.js`
   - Environment: `Node`
   - Instance Type: `Free`

4. **Environment Variables** (set in Render dashboard):
   ```
   PORT=3001
   IOTA_NETWORK=testnet
   PACKAGE_ID=         (leave empty for demo mode)
   STAKE_POOL_ID=      (leave empty for demo mode)
   ADMIN_PRIVATE_KEY=  (leave empty for demo mode)
   ```

5. **Deploy** → You get a URL like `https://trustbridge-backend.onrender.com`

6. **Update frontend** to point at this URL.

---

## Option 2: Deploy to Railway.app

1. Push to GitHub (same as above)
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Railway auto-detects Node.js
4. Add environment variables in the dashboard
5. You get a URL like `https://trustbridge-backend-production.up.railway.app`

---

## Option 3: Run Locally with ngrok (Quick Demo)

If you just need a public URL for a few hours:

```bash
cd backend
npm install
npm run dev          # starts on localhost:3001

# In another terminal:
npx ngrok http 3001  # gives you a public https://xxx.ngrok.io URL
```

---

## Frontend Integration

The frontend at `https://damianrebolo.github.io/web3-trustbridge` currently uses mock data.

To connect it to the real backend, the frontend developer needs to:

1. **Add an environment variable** for the API URL:
   ```
   VITE_API_URL=https://trustbridge-backend.onrender.com
   ```
   (Rsbuild uses VITE-style env vars, or configure in `rsbuild.config.ts`)

2. **Replace mock data** in the three components with fetch calls:
   - `Dashboard.tsx` → calls `/api/profile/create`, `/api/staking/stake`, etc.
   - `VerifierView.tsx` → calls `/api/profile/{id}/trust-chain`, `/api/identity/verify-credential`
   - `Landing.tsx` → no API calls needed

3. **See `INTEGRATION_GUIDE.md`** for the exact 13-step API flow with request/response examples.

4. **See `backend/openapi.yaml`** for the full Swagger spec (load at https://editor.swagger.io).

---

## CORS

The backend has `cors()` enabled with no restrictions — any origin can call it.
This is fine for the hackathon. In production, restrict to your frontend domain.

---

## Testing the Deployed Backend

Once deployed, test with:

```bash
# Health check
curl https://YOUR-URL.onrender.com/api/health

# Create a DID
curl -X POST https://YOUR-URL.onrender.com/api/identity/create-did \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Test Company"}'
```

If you see `{"success": true, "did": "did:iota:testnet:0x..."}` — it's working!
