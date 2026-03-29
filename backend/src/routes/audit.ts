import { Router, Request, Response } from 'express';
import * as notarization from '../services/notarization';

const router = Router();

/**
 * GET /api/audit/trail/:profileId
 * Get the audit trail for a specific profile.
 */
router.get('/trail/:profileId', (req: Request, res: Response) => {
  const trail = notarization.getAuditTrail(req.params.profileId);
  res.json({ success: true, trail });
});

/**
 * GET /api/audit/log
 * Get the full audit log.
 */
router.get('/log', (_req: Request, res: Response) => {
  const log = notarization.getFullAuditLog();
  res.json({ success: true, log });
});

/**
 * GET /api/audit/verify
 * Verify the integrity of the audit chain.
 */
router.get('/verify', (_req: Request, res: Response) => {
  const result = notarization.verifyAuditChainIntegrity();
  res.json({ success: true, ...result });
});

export default router;
