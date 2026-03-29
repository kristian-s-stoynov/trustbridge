import { Router, Request, Response } from 'express';
import * as contract from '../services/contract-proxy';
import * as notarization from '../services/notarization';

const router = Router();

/**
 * POST /api/profile/create
 * Create a trust profile on-chain.
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { companyName, domain, did } = req.body;
    if (!companyName || !domain || !did) {
      return res.status(400).json({
        error: 'companyName, domain, and did are required',
      });
    }

    const result = await contract.createProfile(companyName, domain, did);

    // Extract the created profile ID from object changes
    const createdObjects = (result.objectChanges || []).filter(
      (c: any) => c.type === 'created'
    );
    const profileObj = createdObjects.find((c: any) =>
      'objectType' in c && c.objectType?.includes('TrustProfile')
    );

    const profileId = profileObj && 'objectId' in profileObj
      ? (profileObj as any).objectId as string
      : null;

    // Record in audit trail
    if (profileId) {
      await notarization.recordEvent('PROFILE_CREATED', profileId, did, {
        companyName,
        domain,
      });
    }

    res.json({
      success: true,
      profileId,
      transactionDigest: result.digest,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/profile/:id
 * Get a trust profile by its on-chain object ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const profile = await contract.getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/profile/:id/verify
 * Mark a profile as verified (★).
 */
router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const { adminCapId } = req.body;
    if (!adminCapId) {
      return res.status(400).json({ error: 'adminCapId is required' });
    }

    const result = await contract.markVerified(req.params.id, adminCapId);

    await notarization.recordEvent(
      'PROFILE_VERIFIED',
      req.params.id,
      'admin',
      {}
    );

    res.json({
      success: true,
      transactionDigest: result.digest,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/profile/:id/record-deal
 * Record a completed deal.
 */
router.post('/:id/record-deal', async (req: Request, res: Response) => {
  try {
    const { adminCapId } = req.body;
    if (!adminCapId) {
      return res.status(400).json({ error: 'adminCapId is required' });
    }

    const result = await contract.recordDeal(req.params.id, adminCapId);

    await notarization.recordEvent(
      'DEAL_RECORDED',
      req.params.id,
      'admin',
      {}
    );

    res.json({
      success: true,
      transactionDigest: result.digest,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/profile/:id/vouch
 * Mark a profile as vouched (★★★★).
 */
router.post('/:id/vouch', async (req: Request, res: Response) => {
  try {
    const { adminCapId } = req.body;
    if (!adminCapId) {
      return res.status(400).json({ error: 'adminCapId is required' });
    }

    const result = await contract.markVouched(req.params.id, adminCapId);

    res.json({
      success: true,
      transactionDigest: result.digest,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/profile/:id/slash
 * Slash a fraudulent company.
 */
router.post('/:id/slash', async (req: Request, res: Response) => {
  try {
    const { adminCapId } = req.body;
    if (!adminCapId) {
      return res.status(400).json({ error: 'adminCapId is required' });
    }

    const result = await contract.slashProfile(req.params.id, adminCapId);

    await notarization.recordEvent(
      'PROFILE_SLASHED',
      req.params.id,
      'admin',
      {}
    );

    res.json({
      success: true,
      transactionDigest: result.digest,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/profile/:id/trust-chain
 * Get the full trust chain visualization data for a profile.
 */
router.get('/:id/trust-chain', async (req: Request, res: Response) => {
  try {
    const profile = await contract.getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

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

export default router;
