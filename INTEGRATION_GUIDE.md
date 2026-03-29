# TrustBridge — Frontend Integration Guide

## Quick Start

```bash
cd backend
cp .env.example .env   # fill in after contract deployment
npm install
npm run dev             # starts on http://localhost:3001
```

Swagger spec: `backend/openapi.yaml` — load it in https://editor.swagger.io or Swagger UI.

---

## API Base URL

```
http://localhost:3001/api
```

---

## The Three Roles

| Role | What they do | Key endpoints |
|------|-------------|---------------|
| **Attester** | Country's company registry (authority). Creates DID, issues Verifiable Credentials to companies. | `/identity/create-did`, `/identity/issue-credential` |
| **Company** | Business building trust. Creates DID, creates profile, stakes tokens, completes deals. | `/identity/create-did`, `/profile/create`, `/staking/stake` |
| **Verifier** | Any party checking a company before doing business. Verifies credentials, checks profile. | `/identity/verify-credential`, `/profile/{id}`, `/profile/{id}/trust-chain` |

---

## Demo Flow — Step by Step

This is the exact sequence to implement in the frontend for the hackathon demo.
Each step includes the API call and expected result.

### Step 1: Attester creates DID

The attester is the **country's company registry** (e.g., German Handelsregister, UK Companies House).

```
POST /api/identity/create-did
{
  "companyName": "German Federal Company Registry"
}
```

Response:
```json
{
  "success": true,
  "did": "did:iota:testnet:0x84b6...",
  "document": { ... }
}
```

**Save** `attesterDid` — needed in Step 4.

---

### Step 2: Company creates DID

```
POST /api/identity/create-did
{
  "companyName": "Acme Corporation Ltd."
}
```

**Save** `companyDid` — needed in Steps 3, 4.

---

### Step 3: Company creates on-chain trust profile

```
POST /api/profile/create
{
  "companyName": "Acme Corporation Ltd.",
  "domain": "acme.com",
  "did": "<companyDid from Step 2>"
}
```

Response:
```json
{
  "success": true,
  "profileId": "0xabc123...",
  "transactionDigest": "..."
}
```

**Save** `profileId` — this is the on-chain object ID, used in most subsequent calls.

At this point: **☆☆☆☆ (0 stars)**

---

### Step 4: Attester issues Verifiable Credential → ★ Verified

This is the company registry confirming "this company legally exists."

```
POST /api/identity/issue-credential
{
  "issuerDid": "<attesterDid from Step 1>",
  "subjectDid": "<companyDid from Step 2>",
  "credentialType": "BusinessRegistrationCredential",
  "claims": {
    "registrationNumber": "HRB-12345",
    "jurisdiction": "DE",
    "incorporationDate": "2020-06-15",
    "legalName": "Acme Corporation Ltd."
  }
}
```

Response:
```json
{
  "success": true,
  "jwt": "eyJhbGci...",
  "credentialHash": "8cc7a975..."
}
```

**Save** `jwt` and `credentialHash`.

---

### Step 5: Anchor credential on-chain

```
POST /api/attestation/register
{
  "companyProfileId": "<profileId from Step 3>",
  "attesterDid": "<attesterDid from Step 1>",
  "credentialHash": "<credentialHash from Step 4>",
  "credentialType": "BusinessRegistrationCredential"
}
```

**Save** `recordId` from response.

---

### Step 6: Mark profile as verified

```
POST /api/profile/<profileId>/verify
{
  "adminCapId": "<adminCapId>"
}
```

Now: **★☆☆☆ (1 star) — Verified!**

---

### Step 7: Company stakes tokens → ★★ Staked

```
POST /api/staking/stake
{
  "profileId": "<profileId>",
  "amount": 10
}
```

Now: **★★☆☆ (2 stars) — Verified + Staked!**

---

### Step 8: Record completed deals → ★★★ Proven

Call this 3 times (or have the backend call it after each deal):

```
POST /api/profile/<profileId>/record-deal
{
  "adminCapId": "<adminCapId>"
}
```

After 3 deals: **★★★☆ (3 stars) — Verified + Staked + Proven!**

---

### Step 9: Verifier checks profile

This is what a potential business partner sees:

```
GET /api/profile/<profileId>/trust-chain
```

Response:
```json
{
  "success": true,
  "trustChain": {
    "profile": {
      "companyName": "Acme Corporation Ltd.",
      "trustStars": 3,
      "isVerified": true,
      "isStaked": true,
      "isProven": true,
      "isVouched": false,
      "completedDeals": 3,
      "isSlashed": false
    },
    "auditTrail": [ ... ],
    "stars": {
      "verified": true,
      "staked": true,
      "proven": true,
      "vouched": false,
      "total": 3
    }
  }
}
```

The verifier can also independently verify the credential:

```
POST /api/identity/verify-credential
{
  "jwt": "<jwt from Step 4>"
}
```

---

### Step 10: Verify credential

```
POST /api/identity/verify-credential
{
  "jwt": "<jwt from Step 4>"
}
```

Response:
```json
{
  "success": true,
  "verification": {
    "isValid": true,
    "issuerDid": "did:iota:testnet:0x84b6...",
    "subjectDid": "did:iota:testnet:0x7fb8...",
    "credentialType": "BusinessRegistrationCredential",
    "issuedAt": "2026-03-27T00:23:21.986Z"
  }
}
```

---

### Step 11 (Demo — Revocation): Attester revokes credential

Show what happens when a company fails compliance:

```
POST /api/attestation/revoke
{
  "attestationRecordId": "<recordId from Step 5>",
  "adminCapId": "<adminCapId>"
}
```

---

### Step 12 (Demo — Slashing): Platform slashes fraudulent company

Show the economic penalty:

```
POST /api/staking/slash
{
  "profileId": "<profileId>",
  "stakerAddress": "<company's IOTA address>",
  "adminCapId": "<adminCapId>"
}
```

Then slash the profile:

```
POST /api/profile/<profileId>/slash
{
  "adminCapId": "<adminCapId>"
}
```

Now: **☆☆☆☆ (0 stars) — SLASHED. Stake confiscated.**

---

### Step 13: Verify audit chain integrity

Show that no one has tampered with the records:

```
GET /api/audit/verify
```

Response:
```json
{
  "success": true,
  "isValid": true
}
```

---

## Audit Trail

Every trust event is recorded in a hash-chain (each entry includes the hash of the previous entry).

```
GET /api/audit/trail/<profileId>
```

Event types:
- `PROFILE_CREATED` — Company registered on the platform
- `CREDENTIAL_ISSUED` — Attester issued a Verifiable Credential
- `CREDENTIAL_REVOKED` — Attester revoked a credential
- `PROFILE_VERIFIED` — Profile earned the ★ Verified star
- `STAKE_DEPOSITED` — Company staked tokens
- `STAKE_WITHDRAWN` — Company withdrew stake
- `STAKE_SLASHED` — Company's stake was confiscated
- `DEAL_RECORDED` — A deal was completed
- `VOUCH_CREATED` — A peer company vouched
- `PROFILE_SLASHED` — Profile was permanently flagged

---

## Trust Stars Visual Reference

```
☆☆☆☆  →  New profile (no trust)
★☆☆☆  →  Verified by authority (credential issued)
★★☆☆  →  + Staked tokens as collateral
★★★☆  →  + Proven through completed deals (3+)
★★★★  →  + Vouched by peer companies
```

Slashed: all stars reset to 0, stake confiscated, profile permanently flagged.

---

## Error Handling

All errors return:
```json
{
  "error": "Description of what went wrong"
}
```

HTTP status codes:
- `200` — Success
- `400` — Missing or invalid parameters
- `404` — Object not found
- `500` — Server/blockchain error

---

## Important IDs to Track

After deploying contracts, the backend needs these in `.env`:

| Variable | What | Where to get it |
|----------|------|----------------|
| `PACKAGE_ID` | Deployed Move package address | From `iota client publish` output |
| `STAKE_POOL_ID` | Shared StakePool object | From publish output (shared object) |
| `ADMIN_PRIVATE_KEY` | Admin signer key | From `iota client new-address` |

The frontend needs to pass `adminCapId` in requests that require admin auth.
The AdminCap object ID comes from the publish output (owned object transferred to publisher).
