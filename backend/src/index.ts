/**
 * TrustBridge Backend — Full API
 *
 * Combines:
 * 1. Real IOTA DID creation/resolution (via @iota/identity-wasm)
 * 2. Trust Profile management (demo mode — in-memory simulation)
 * 3. Staking (demo mode)
 * 4. Attestation registry (demo mode)
 * 5. Audit trail with hash-chain integrity
 * 6. Verifiable Credential issuance/verification
 */

import express from 'express';
import cors from 'cors';
import * as identityReal from './services/identity-real';
import * as contractDemo from './services/contract-demo';
import * as notarization from './services/notarization';
import * as identityService from './services/identity';

const app = express();

app.use(cors());
app.use(express.json());

// ══════════════════════════════════════════════════════
// HEALTH
// ══════════════════════════════════════════════════════

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: 'full-api',
    network: 'testnet',
    description: 'TrustBridge — Full API (real IOTA DID + demo trust profiles)',
  });
});

// ══════════════════════════════════════════════════════
// IDENTITY — Real IOTA DIDs on testnet
// ══════════════════════════════════════════════════════

/**
 * POST /api/identity/create-did
 * Create a REAL DID on the IOTA testnet (~10s).
 */
app.post('/api/identity/create-did', async (req, res) => {
  try {
    const { companyName } = req.body;
    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }

    console.log(`Creating real DID for "${companyName}"...`);
    const result = await identityReal.createDID(companyName);
    console.log(`DID created: ${result.did}`);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('DID creation failed:', err);
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/identity/resolve/*
 * Resolve a DID from the IOTA testnet.
 */
app.get('/api/identity/resolve/*', async (req, res) => {
  try {
    const did = (req.params as any)[0];
    if (!did) {
      return res.status(400).json({ error: 'DID is required' });
    }

    const document = await identityReal.resolveDID(did);
    if (!document) {
      return res.status(404).json({ error: 'DID not found on chain' });
    }

    res.json({ success: true, did, document });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/identity/demo
 * Get the pre-created demo DID (Acme Global Labs).
 */
app.get('/api/identity/demo', (_req, res) => {
  const demo = identityReal.getDemoDid();
  if (!demo) {
    return res.status(404).json({ error: 'No demo DID found' });
  }
  res.json({ success: true, ...demo });
});

/**
 * GET /api/identity/list
 * List all DIDs created in this session.
 */
app.get('/api/identity/list', (_req, res) => {
  res.json({ success: true, dids: identityReal.listCreatedDids() });
});

// ══════════════════════════════════════════════════════
// VERIFIABLE CREDENTIALS
// ══════════════════════════════════════════════════════

/**
 * POST /api/identity/issue-credential
 * Attester issues a Verifiable Credential to a company.
 */
app.post('/api/identity/issue-credential', async (req, res) => {
  try {
    const { issuerDid, subjectDid, credentialType, claims } = req.body;
    if (!issuerDid || !subjectDid || !credentialType) {
      return res.status(400).json({
        error: 'issuerDid, subjectDid, and credentialType are required',
      });
    }

    const result = await identityService.issueCredential(
      issuerDid, subjectDid, credentialType, claims || {}
    );

    await notarization.recordEvent('CREDENTIAL_ISSUED', subjectDid, issuerDid, {
      credentialType, hash: result.hash,
    });

    res.json({ success: true, jwt: result.jwt, credentialHash: result.hash });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/identity/verify-credential
 * Verify a Verifiable Credential JWT.
 */
app.post('/api/identity/verify-credential', async (req, res) => {
  try {
    const { jwt } = req.body;
    if (!jwt) {
      return res.status(400).json({ error: 'jwt is required' });
    }

    const result = await identityService.verifyCredential(jwt);
    res.json({ success: true, verification: result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/identity/dids
 * List all DIDs from the mock identity service.
 */
app.get('/api/identity/dids', (_req, res) => {
  res.json({ success: true, dids: identityService.listDIDs() });
});

/**
 * GET /api/identity/credentials
 * List all issued VCs.
 */
app.get('/api/identity/credentials', (_req, res) => {
  res.json({ success: true, credentials: identityService.listCredentials() });
});

// ══════════════════════════════════════════════════════
// TRUST PROFILES (demo mode — in-memory)
// ══════════════════════════════════════════════════════

/**
 * POST /api/profile/create
 */
app.post('/api/profile/create', async (req, res) => {
  try {
    const { companyName, domain, did } = req.body;
    if (!companyName || !domain || !did) {
      return res.status(400).json({ error: 'companyName, domain, and did are required' });
    }

    const result = await contractDemo.createProfile(companyName, domain, did);

    const createdObjects = (result.objectChanges || []).filter((c: any) => c.type === 'created');
    const profileObj = createdObjects.find((c: any) =>
      'objectType' in c && c.objectType?.includes('TrustProfile')
    );
    const profileId = profileObj && 'objectId' in profileObj
      ? (profileObj as any).objectId as string : null;

    if (profileId) {
      await notarization.recordEvent('PROFILE_CREATED', profileId, did, { companyName, domain });
    }

    res.json({ success: true, profileId, transactionDigest: result.digest });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/profile/:id
 */
app.get('/api/profile/:id', async (req, res) => {
  try {
    const profile = await contractDemo.getProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/profile/:id/verify
 */
app.post('/api/profile/:id/verify', async (req, res) => {
  try {
    const { adminCapId } = req.body;
    const result = await contractDemo.markVerified(req.params.id, adminCapId || '0xadmin');
    await notarization.recordEvent('PROFILE_VERIFIED', req.params.id, 'admin', {});
    res.json({ success: true, transactionDigest: result.digest });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/profile/:id/record-deal
 */
app.post('/api/profile/:id/record-deal', async (req, res) => {
  try {
    const { adminCapId } = req.body;
    const result = await contractDemo.recordDeal(req.params.id, adminCapId || '0xadmin');
    await notarization.recordEvent('DEAL_RECORDED', req.params.id, 'admin', {});
    res.json({ success: true, transactionDigest: result.digest });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/profile/:id/vouch
 */
app.post('/api/profile/:id/vouch', async (req, res) => {
  try {
    const { adminCapId } = req.body;
    const result = await contractDemo.markVouched(req.params.id, adminCapId || '0xadmin');
    await notarization.recordEvent('VOUCH_CREATED', req.params.id, 'admin', {});
    res.json({ success: true, transactionDigest: result.digest });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/profile/:id/slash
 */
app.post('/api/profile/:id/slash', async (req, res) => {
  try {
    const { adminCapId } = req.body;
    const result = await contractDemo.slashProfile(req.params.id, adminCapId || '0xadmin');
    await notarization.recordEvent('PROFILE_SLASHED', req.params.id, 'admin', {});
    res.json({ success: true, transactionDigest: result.digest });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/profile/:id/trust-chain
 * Full trust chain for verifier view.
 */
app.get('/api/profile/:id/trust-chain', async (req, res) => {
  try {
    const profile = await contractDemo.getProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const auditTrail = notarization.getAuditTrail(req.params.id);

    res.json({
      success: true,
      trustChain: {
        profile,
        auditTrail,
        stars: {
          verified: profile.isVerified,
          staked: profile.isStaked,
          proven: profile.isProven,
          vouched: profile.isVouched,
          total: profile.trustStars,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/profiles
 * List all profiles (demo helper).
 */
app.get('/api/profiles', (_req, res) => {
  res.json({ success: true, profiles: contractDemo.listProfiles() });
});

// ══════════════════════════════════════════════════════
// STAKING (demo mode — in-memory)
// ══════════════════════════════════════════════════════

/**
 * POST /api/staking/stake
 */
app.post('/api/staking/stake', async (req, res) => {
  try {
    const { profileId, amount } = req.body;
    if (!profileId || !amount) {
      return res.status(400).json({ error: 'profileId and amount are required' });
    }

    await contractDemo.stake(profileId, amount);
    await notarization.recordEvent('STAKE_DEPOSITED', profileId, 'company', { amount });

    res.json({ success: true, transactionDigest: `demo-stake-${Date.now()}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/staking/unstake
 */
app.post('/api/staking/unstake', async (req, res) => {
  try {
    const { profileId } = req.body;
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });

    await contractDemo.unstake(profileId);
    await notarization.recordEvent('STAKE_WITHDRAWN', profileId, 'company', {});

    res.json({ success: true, transactionDigest: `demo-unstake-${Date.now()}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/staking/slash
 */
app.post('/api/staking/slash', async (req, res) => {
  try {
    const { profileId, stakerAddress, adminCapId } = req.body;
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });

    await contractDemo.slashStake(stakerAddress || '0x0', profileId, adminCapId || '0xadmin');
    await notarization.recordEvent('STAKE_SLASHED', profileId, 'admin', { stakerAddress });

    res.json({ success: true, transactionDigest: `demo-slash-${Date.now()}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/staking/pool
 */
app.get('/api/staking/pool', async (_req, res) => {
  try {
    const pool = await contractDemo.getStakePool();
    res.json({ success: true, pool });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ══════════════════════════════════════════════════════
// ATTESTATION (demo mode — in-memory)
// ══════════════════════════════════════════════════════

/**
 * POST /api/attestation/register
 */
app.post('/api/attestation/register', async (req, res) => {
  try {
    const { companyProfileId, attesterDid, credentialHash, credentialType } = req.body;
    if (!companyProfileId || !attesterDid || !credentialHash || !credentialType) {
      return res.status(400).json({
        error: 'companyProfileId, attesterDid, credentialHash, and credentialType are required',
      });
    }

    const result = await contractDemo.registerAttestation(
      companyProfileId, attesterDid, credentialHash, credentialType
    );

    const createdObjects = (result.objectChanges || []).filter((c: any) => c.type === 'created');
    const recordObj = createdObjects.find((c: any) =>
      'objectType' in c && c.objectType?.includes('AttestationRecord')
    );
    const recordId = recordObj && 'objectId' in recordObj
      ? (recordObj as any).objectId as string : null;

    await notarization.recordEvent('CREDENTIAL_ISSUED', companyProfileId, attesterDid, {
      credentialType, credentialHash, recordId,
    });

    res.json({ success: true, recordId, transactionDigest: result.digest });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/attestation/revoke
 */
app.post('/api/attestation/revoke', async (req, res) => {
  try {
    const { attestationRecordId, adminCapId } = req.body;
    if (!attestationRecordId) {
      return res.status(400).json({ error: 'attestationRecordId is required' });
    }

    const result = await contractDemo.revokeAttestation(attestationRecordId, adminCapId || '0xadmin');
    await notarization.recordEvent('CREDENTIAL_REVOKED', attestationRecordId, 'admin', {});

    res.json({ success: true, transactionDigest: result.digest });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/attestation/:id
 */
app.get('/api/attestation/:id', async (req, res) => {
  try {
    const record = await contractDemo.getAttestation(req.params.id);
    if (!record) return res.status(404).json({ error: 'Attestation record not found' });
    res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/attestations
 * List all attestations (demo helper).
 */
app.get('/api/attestations', (_req, res) => {
  res.json({ success: true, attestations: contractDemo.listAttestations() });
});

// ══════════════════════════════════════════════════════
// AUDIT TRAIL
// ══════════════════════════════════════════════════════

/**
 * GET /api/audit/trail/:profileId
 */
app.get('/api/audit/trail/:profileId', (req, res) => {
  res.json({ success: true, trail: notarization.getAuditTrail(req.params.profileId) });
});

/**
 * GET /api/audit/log
 */
app.get('/api/audit/log', (_req, res) => {
  res.json({ success: true, log: notarization.getFullAuditLog() });
});

/**
 * GET /api/audit/verify
 */
app.get('/api/audit/verify', (_req, res) => {
  const result = notarization.verifyAuditChainIntegrity();
  res.json({ success: true, ...result });
});

// ══════════════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════════════

const port = parseInt(process.env.PORT || '3001', 10);
app.listen(port, '0.0.0.0', () => {
  console.log(`\n🔗 TrustBridge FULL API running on port ${port}`);
  console.log(`   Mode: Real IOTA DID + Demo trust profiles`);
  console.log(`   Network: IOTA Testnet\n`);
  console.log(`   Identity (real on-chain):`);
  console.log(`     GET  /api/identity/demo`);
  console.log(`     POST /api/identity/create-did`);
  console.log(`     GET  /api/identity/resolve/:did`);
  console.log(`     POST /api/identity/issue-credential`);
  console.log(`     POST /api/identity/verify-credential`);
  console.log(`   Profiles (demo):`);
  console.log(`     POST /api/profile/create`);
  console.log(`     GET  /api/profile/:id`);
  console.log(`     GET  /api/profile/:id/trust-chain`);
  console.log(`     POST /api/profile/:id/verify`);
  console.log(`     POST /api/profile/:id/record-deal`);
  console.log(`     POST /api/profile/:id/vouch`);
  console.log(`     POST /api/profile/:id/slash`);
  console.log(`   Staking (demo):`);
  console.log(`     POST /api/staking/stake`);
  console.log(`     POST /api/staking/unstake`);
  console.log(`     POST /api/staking/slash`);
  console.log(`     GET  /api/staking/pool`);
  console.log(`   Attestation (demo):`);
  console.log(`     POST /api/attestation/register`);
  console.log(`     POST /api/attestation/revoke`);
  console.log(`     GET  /api/attestation/:id`);
  console.log(`   Audit:`);
  console.log(`     GET  /api/audit/trail/:profileId`);
  console.log(`     GET  /api/audit/log`);
  console.log(`     GET  /api/audit/verify\n`);
});
