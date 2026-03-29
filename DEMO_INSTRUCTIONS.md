# TrustBridge — Demo Instructions

## Live Links

| What | URL |
|------|-----|
| **Backend API** | https://trustbridge-api-by76.onrender.com |
| **Frontend** | https://damianrebolo.github.io/web3-trustbridge |
| **GitHub Repo** | https://github.com/kristian-s-stoynov/trustbridge |
| **IOTA Explorer (DID)** | https://explorer.iota.org/object/0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369?network=testnet |

---

## What We Built

TrustBridge creates **real Decentralized Identifiers (DIDs)** on the **IOTA Rebased blockchain** (testnet).

A company gets an on-chain identity that is:
- **Tamper-proof** — stored on the IOTA blockchain, nobody can fake it
- **Verifiable** — anyone can resolve the DID and check the company exists
- **Portable** — the DID follows the W3C standard, works across platforms
- **Owned** — controlled by the company's cryptographic keypair (wallet)

---

## Demo Script (for presenting)

### 1. Show the live DID

Open a browser and go to:
```
https://trustbridge-api-by76.onrender.com/api/identity/demo
```

You'll see the real on-chain DID for **Acme Global Labs**:
```json
{
  "success": true,
  "did": "did:iota:testnet:0x3de46f837c3f...",
  "companyName": "Acme Global Labs",
  "explorerUrl": "https://explorer.iota.org/object/0x3de46f...?network=testnet",
  "document": {
    "doc": {
      "id": "did:iota:testnet:0x3de46f...",
      "verificationMethod": [{ "type": "JsonWebKey2020", ... }]
    },
    "meta": { "created": "2026-03-29T22:43:20Z" }
  }
}
```

**Talking point:** "This DID was published on the IOTA blockchain. Let me show you it on the explorer."

### 2. Show it on the IOTA Explorer

Open:
```
https://explorer.iota.org/object/0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369?network=testnet
```

**Talking point:** "This is a real on-chain object of type `Identity`. It was created on March 29 and lives permanently on the IOTA Rebased testnet. Nobody can tamper with it."

### 3. Resolve the DID (prove it's real)

Open:
```
https://trustbridge-api-by76.onrender.com/api/identity/resolve/did:iota:testnet:0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369
```

**Talking point:** "Any company can resolve this DID and verify the identity. Our backend queries the IOTA blockchain in real-time — this isn't cached, it's a live on-chain resolution."

### 4. Create a NEW DID live (wow moment)

Using curl or Postman:
```bash
curl -X POST https://trustbridge-api-by76.onrender.com/api/identity/create-did \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Demo Company GmbH"}'
```

This takes ~10 seconds. Behind the scenes:
1. A new Ed25519 keypair is generated (a new blockchain wallet)
2. The wallet gets funded from the IOTA testnet faucet
3. A DID Document is published on the IOTA blockchain
4. The response includes the new DID and an explorer link

**Talking point:** "We just created a brand new decentralized identity on the blockchain, in real-time. You can click the explorer link to verify it exists on-chain."

### 5. Show the frontend

Open:
```
https://damianrebolo.github.io/web3-trustbridge
```

Walk through the UI showing how the trust profile concept works with the DID backing it.

---

## API Quick Reference

| Endpoint | What it does |
|----------|-------------|
| `GET /api/health` | Health check — shows server is connected to IOTA testnet |
| `GET /api/identity/demo` | Returns the pre-created Acme Global Labs DID |
| `POST /api/identity/create-did` | Creates a NEW DID on-chain (~10s) — body: `{"companyName": "..."}` |
| `GET /api/identity/resolve/<did>` | Resolves any DID from the IOTA blockchain in real-time |
| `GET /api/identity/list` | Lists all DIDs created in the current server session |

---

## Try It Yourself (curl commands)

### Health check
```bash
curl https://trustbridge-api-by76.onrender.com/api/health
```

### Get the Acme Global Labs DID
```bash
curl https://trustbridge-api-by76.onrender.com/api/identity/demo
```

### Resolve a DID from the blockchain
```bash
curl "https://trustbridge-api-by76.onrender.com/api/identity/resolve/did:iota:testnet:0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369"
```

### Create a new DID on-chain
```bash
curl -X POST https://trustbridge-api-by76.onrender.com/api/identity/create-did \
  -H "Content-Type: application/json" \
  -d '{"companyName": "My Test Company"}'
```

---

## Technical Architecture

```
Frontend (GitHub Pages)          Backend (Render.com)           IOTA Rebased Testnet
+---------------------+         +---------------------+        +-------------------+
|                     |  fetch  |                     |  SDK   |                   |
| damianrebolo.github | ------> | trustbridge-api-    | -----> | Identity Object   |
| .io/web3-trustbridge|         | by76.onrender.com   |        | (on-chain DID)    |
|                     | <------ |                     | <----- |                   |
| Shows:              |  JSON   | Uses:               | resolve| Stores:           |
| - Company name      |         | - @iota/identity-   |        | - DID Document    |
| - DID identifier    |         |   wasm (real SDK)   |        | - Public key      |
| - Explorer link     |         | - Ed25519 keypairs  |        | - Metadata        |
| - Trust stars       |         | - Testnet faucet    |        |                   |
+---------------------+         +---------------------+        +-------------------+
```

### Key Technical Details

- **DID Standard:** W3C Decentralized Identifiers (DIDs) v1.0
- **Blockchain:** IOTA Rebased (Move-based, similar to Sui)
- **SDK:** `@iota/identity-wasm` v1.9.2-beta.1
- **Key Type:** Ed25519 (EdDSA signatures)
- **DID Method:** `did:iota:testnet:0x<object_id>`
- **On-chain Object Type:** `identity::Identity`

### Private Keys

The frontend **never** touches private keys. The backend:
- Generates a new Ed25519 keypair per DID
- Funds it from the IOTA testnet faucet
- Signs the transaction server-side
- Returns only the public DID and explorer link

In production, users would sign with their own IOTA wallet.

---

## Troubleshooting

**Backend returns 500 or is slow:**
Render free tier spins down after inactivity. The first request after idle takes ~30 seconds. Subsequent requests are fast.

**"Create DID" takes long:**
This is expected — it's a real blockchain transaction. It needs to fund a wallet from the faucet and publish on-chain. ~10 seconds.

**Explorer doesn't load:**
The IOTA explorer requires JavaScript. Make sure to wait for it to fully load.

---

## The Acme Global Labs DID

This is the real, live DID we created on the IOTA blockchain:

```
DID:        did:iota:testnet:0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369
Object ID:  0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369
Wallet:     0xcd48685401ee02cf019897f317772dea4c9ffd4ac15bf4a8a32b43bf48b5d15c
Created:    2026-03-29T22:43:20Z
Key Type:   Ed25519 / JsonWebKey2020
Explorer:   https://explorer.iota.org/object/0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369?network=testnet
```
