import { Router, Request, Response } from 'express';
import * as identityService from '../services/identity';
import * as notarization from '../services/notarization';

const router = Router();

/**
 * POST /api/identity/create-did
 * Create a DID for a company or attester.
 *
 * Returns the DID, the controlling wallet address, and the DID document.
 * Optionally accepts a walletAddress to link to an existing wallet.
 */
router.post('/create-did', async (req: Request, res: Response) => {
  try {
    const { companyName, walletAddress } = req.body;
    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }

    const result = await identityService.createDID(companyName, walletAddress);

    res.json({
      success: true,
      did: result.did,
      address: result.address,     // IOTA wallet address that controls this DID
      publicKey: result.publicKey,  // Ed25519 public key
      document: result.document,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/identity/issue-credential
 * Attester issues a Verifiable Credential to a company.
 */
router.post('/issue-credential', async (req: Request, res: Response) => {
  try {
    const { issuerDid, subjectDid, credentialType, claims } = req.body;

    if (!issuerDid || !subjectDid || !credentialType) {
      return res.status(400).json({
        error: 'issuerDid, subjectDid, and credentialType are required',
      });
    }

    const result = await identityService.issueCredential(
      issuerDid,
      subjectDid,
      credentialType,
      claims || {}
    );

    // Record in audit trail
    await notarization.recordEvent(
      'CREDENTIAL_ISSUED',
      subjectDid,
      issuerDid,
      { credentialType, hash: result.hash }
    );

    res.json({
      success: true,
      jwt: result.jwt,
      credentialHash: result.hash,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/identity/verify-credential
 * Verify a Verifiable Credential JWT.
 */
router.post('/verify-credential', async (req: Request, res: Response) => {
  try {
    const { jwt } = req.body;
    if (!jwt) {
      return res.status(400).json({ error: 'jwt is required' });
    }

    const result = await identityService.verifyCredential(jwt);

    res.json({
      success: true,
      verification: result,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/identity/resolve/:did
 * Resolve a DID to its document and wallet address.
 */
router.get('/resolve/:did(*)', async (req: Request, res: Response) => {
  try {
    const result = await identityService.resolveDID(req.params.did);
    if (!result) {
      return res.status(404).json({ error: 'DID not found' });
    }

    res.json({
      success: true,
      did: result.did,
      address: result.address,
      publicKey: result.publicKey,
      document: result.document,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/identity/by-address/:address
 * Look up a DID by its controlling wallet address.
 *
 * This is the key endpoint for the frontend:
 * "User connects wallet → what DID does this wallet own?"
 */
router.get('/by-address/:address', async (req: Request, res: Response) => {
  try {
    const result = await identityService.resolveByAddress(req.params.address);
    if (!result) {
      return res.status(404).json({
        error: 'No DID found for this address',
        address: req.params.address,
      });
    }

    res.json({
      success: true,
      did: result.did,
      address: result.address,
      publicKey: result.publicKey,
      document: result.document,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/identity/dids
 * List all DIDs (demo helper).
 */
router.get('/dids', (_req: Request, res: Response) => {
  res.json({
    success: true,
    dids: identityService.listDIDs(),
  });
});

/**
 * GET /api/identity/credentials
 * List all issued VCs (demo helper).
 */
router.get('/credentials', (_req: Request, res: Response) => {
  res.json({
    success: true,
    credentials: identityService.listCredentials(),
  });
});

export default router;
