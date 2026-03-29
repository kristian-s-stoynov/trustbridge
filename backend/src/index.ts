import express from 'express';
import cors from 'cors';
import * as identityReal from './services/identity-real';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ──────────────────────────────────────────────
// Health
// ──────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    network: 'testnet',
    description: 'TrustBridge — IOTA Digital Identity backend',
  });
});

// ──────────────────────────────────────────────
// DID Endpoints — the minimal MVP
// ──────────────────────────────────────────────

/**
 * POST /api/identity/create-did
 * Create a REAL DID on the IOTA testnet.
 *
 * This takes ~10 seconds because it:
 * 1. Generates a new Ed25519 keypair
 * 2. Funds it from the testnet faucet
 * 3. Publishes the DID Document on-chain
 */
app.post('/api/identity/create-did', async (req, res) => {
  try {
    const { companyName } = req.body;
    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }

    console.log(`Creating DID for "${companyName}"...`);
    const result = await identityReal.createDID(companyName);
    console.log(`DID created: ${result.did}`);

    res.json({
      success: true,
      did: result.did,
      objectId: result.objectId,
      senderAddress: result.senderAddress,
      explorerUrl: result.explorerUrl,
      document: result.document,
      companyName: result.companyName,
      createdAt: result.createdAt,
    });
  } catch (err) {
    console.error('DID creation failed:', err);
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/identity/resolve/:did
 * Resolve a DID from the IOTA testnet.
 *
 * The :did parameter uses did:iota:testnet:0x... format.
 * We use a wildcard route (*) because the DID contains colons.
 */
app.get('/api/identity/resolve/*', async (req, res) => {
  try {
    // The DID is everything after /resolve/
    const did = (req.params as any)[0];
    if (!did) {
      return res.status(400).json({ error: 'DID is required' });
    }

    console.log(`Resolving DID: ${did}`);
    const document = await identityReal.resolveDID(did);
    if (!document) {
      return res.status(404).json({ error: 'DID not found on chain' });
    }

    res.json({
      success: true,
      did,
      document,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/identity/demo
 * Get the pre-created demo DID (Acme Global Labs).
 *
 * This is the fastest endpoint — returns the DID we already created.
 * The frontend can call this on page load.
 */
app.get('/api/identity/demo', (_req, res) => {
  const demo = identityReal.getDemoDid();
  if (!demo) {
    return res.status(404).json({
      error: 'No demo DID found. Create one first with POST /api/identity/create-did',
    });
  }

  res.json({
    success: true,
    ...demo,
  });
});

/**
 * GET /api/identity/list
 * List all DIDs created in this session.
 */
app.get('/api/identity/list', (_req, res) => {
  res.json({
    success: true,
    dids: identityReal.listCreatedDids(),
  });
});

// ──────────────────────────────────────────────
// Start server
// ──────────────────────────────────────────────

const port = parseInt(process.env.PORT || '3001', 10);
app.listen(port, '0.0.0.0', () => {
  console.log(`\n🔗 TrustBridge backend running on port ${port}`);
  console.log(`   Network: IOTA Testnet`);
  console.log(`   Endpoints:`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/identity/demo         — get pre-created Acme Global Labs DID`);
  console.log(`   POST /api/identity/create-did    — create new DID on-chain (~10s)`);
  console.log(`   GET  /api/identity/resolve/:did  — resolve DID from chain`);
  console.log(`   GET  /api/identity/list           — list all session DIDs\n`);
});
