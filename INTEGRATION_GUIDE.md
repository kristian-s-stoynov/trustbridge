# TrustBridge — Frontend Integration Guide (Minimal MVP)

## What This Is

TrustBridge creates **real Decentralized Identifiers (DIDs)** on the **IOTA Rebased testnet**.
Each DID is an on-chain object visible on the IOTA explorer.

For the MVP demo, we have one pre-created DID for **Acme Global Labs**:

```
DID:      did:iota:testnet:0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369
Explorer: https://explorer.iota.org/object/0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369?network=testnet
```

---

## Backend API

**Base URL (LIVE):** `https://trustbridge-api-by76.onrender.com`
**Base URL (local dev):** `http://localhost:3001`

There are only **4 endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/identity/demo` | Get the pre-created Acme Global Labs DID |
| POST | `/api/identity/create-did` | Create a NEW DID on-chain (~10 seconds) |
| GET | `/api/identity/resolve/<did>` | Resolve any DID from the IOTA testnet |

---

## Frontend Integration — Step by Step

### Step 1: Show the Acme Global Labs DID

On page load, fetch the demo DID:

```javascript
const res = await fetch('https://trustbridge-api-by76.onrender.com/api/identity/demo');
const data = await res.json();

// data contains:
// {
//   success: true,
//   did: "did:iota:testnet:0x3de46f...",
//   objectId: "0x3de46f...",
//   explorerUrl: "https://explorer.iota.org/object/0x3de46f...?network=testnet",
//   companyName: "Acme Global Labs",
//   document: {
//     doc: {
//       id: "did:iota:testnet:0x3de46f...",
//       verificationMethod: [{ type: "JsonWebKey2020", ... }]
//     },
//     meta: { created: "2026-03-29T22:43:20Z", updated: "2026-03-29T22:43:20Z" }
//   },
//   senderAddress: "0xcd48685401ee02cf...",
//   createdAt: "2026-03-29T22:43:25.123Z"
// }
```

**What to display on the frontend:**
- `data.companyName` → "Acme Global Labs"
- `data.did` → The DID identifier (show it shortened or in full)
- `data.explorerUrl` → Link to "View on IOTA Explorer"
- `data.senderAddress` → The IOTA wallet address that controls this DID
- `data.document.meta.created` → When the DID was created on-chain

### Step 2: Create a New DID (optional — for demo "Create Profile" flow)

```javascript
const res = await fetch('https://trustbridge-api-by76.onrender.com/api/identity/create-did', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ companyName: 'My New Company' }),
});
const data = await res.json();

// Same response shape as above
// ⚠️ This takes ~10 seconds because it:
//    1. Generates a new Ed25519 keypair
//    2. Funds it from the IOTA testnet faucet
//    3. Publishes the DID Document on the blockchain
```

**Show a loading spinner** — this is a real blockchain transaction.

### Step 3: Resolve a DID (optional — for "Verify Company" flow)

```javascript
const did = 'did:iota:testnet:0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369';
const res = await fetch(`https://trustbridge-api-by76.onrender.com/api/identity/resolve/${did}`);
const data = await res.json();

// {
//   success: true,
//   did: "did:iota:testnet:0x3de46f...",
//   document: { doc: { ... }, meta: { ... } }
// }
```

---

## What the DID Contains

A DID Document on IOTA looks like this:

```json
{
  "doc": {
    "id": "did:iota:testnet:0x3de46f837c3f...",
    "verificationMethod": [{
      "id": "did:iota:testnet:0x3de46f...#key-1",
      "controller": "did:iota:testnet:0x3de46f...",
      "type": "JsonWebKey2020",
      "publicKeyJwk": {
        "kty": "OKP",
        "alg": "EdDSA",
        "crv": "Ed25519",
        "x": "8jb1cmI9b5UdDfA5kys52dzAdjS1IO_zXWdUqEVWch0"
      }
    }]
  },
  "meta": {
    "created": "2026-03-29T22:43:20Z",
    "updated": "2026-03-29T22:43:20Z"
  }
}
```

Key fields:
- `doc.id` — The globally unique DID
- `doc.verificationMethod` — The cryptographic key that proves ownership
- `meta.created` — When it was published on the IOTA blockchain

---

## Architecture — How It Works

```
Frontend (GitHub Pages)
   │
   │  fetch('/api/identity/demo')
   ▼
Backend (Express on Render.com)
   │
   │  @iota/identity-wasm SDK
   ▼
IOTA Rebased Testnet (blockchain)
   │
   │  Identity Object (on-chain)
   ▼
IOTA Explorer (https://explorer.iota.org)
```

### Regarding Private Keys

**The frontend NEVER sends private keys.** The architecture:

- **Current MVP:** The backend generates a new keypair for each DID creation,
  funds it from the testnet faucet, and signs the transaction server-side.
  The frontend only calls REST endpoints.

- **Production (future):** The frontend would use the IOTA Wallet SDK to let
  the user sign transactions client-side, then the backend relays them.
  Private keys would never leave the user's browser/wallet.

---

## CORS

The backend has `cors()` enabled — any origin can call it. GitHub Pages will work without issues.

---

## Running Locally

```bash
cd backend
npm install
npm run dev   # starts on http://localhost:3001
```

---

## Error Handling

All errors return:
```json
{ "error": "Description of what went wrong" }
```

HTTP codes: `200` success, `400` bad request, `404` not found, `500` server error.

---

## Live DID on IOTA Explorer

The Acme Global Labs DID is already live on the IOTA testnet:

**Explorer link:** https://explorer.iota.org/object/0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369?network=testnet

This is a real on-chain object of type `Identity` on the IOTA Move-based blockchain.
