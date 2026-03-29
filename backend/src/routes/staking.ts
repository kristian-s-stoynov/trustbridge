import { Router, Request, Response } from 'express';
import * as contract from '../services/contract-proxy';
import * as notarization from '../services/notarization';

const router = Router();

/**
 * POST /api/staking/stake
 * Company stakes IOTA tokens.
 */
router.post('/stake', async (req: Request, res: Response) => {
  try {
    const { profileId, amount } = req.body;
    if (!profileId || !amount) {
      return res.status(400).json({
        error: 'profileId and amount (in IOTA) are required',
      });
    }

    const result = await contract.stake(profileId, amount);

    await notarization.recordEvent(
      'STAKE_DEPOSITED',
      profileId,
      'company',
      { amount }
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
 * POST /api/staking/unstake
 * Company withdraws their stake.
 */
router.post('/unstake', async (req: Request, res: Response) => {
  try {
    const { profileId } = req.body;
    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    const result = await contract.unstake(profileId);

    await notarization.recordEvent(
      'STAKE_WITHDRAWN',
      profileId,
      'company',
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
 * POST /api/staking/slash
 * Admin slashes a company's stake.
 */
router.post('/slash', async (req: Request, res: Response) => {
  try {
    const { profileId, stakerAddress, adminCapId } = req.body;
    if (!profileId || !stakerAddress || !adminCapId) {
      return res.status(400).json({
        error: 'profileId, stakerAddress, and adminCapId are required',
      });
    }

    const result = await contract.slashStake(
      stakerAddress,
      profileId,
      adminCapId
    );

    await notarization.recordEvent(
      'STAKE_SLASHED',
      profileId,
      'admin',
      { stakerAddress }
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
 * GET /api/staking/pool
 * Get StakePool stats.
 */
router.get('/pool', async (_req: Request, res: Response) => {
  try {
    const pool = await contract.getStakePool();
    if (!pool) {
      return res.status(404).json({ error: 'StakePool not found' });
    }

    res.json({ success: true, pool });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
