import { Router, Request, Response } from 'express';
import * as contract from '../services/contract-proxy';
import * as notarization from '../services/notarization';

const router = Router();

/**
 * POST /api/attestation/register
 * Register an attestation record on-chain.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { companyProfileId, attesterDid, credentialHash, credentialType } =
      req.body;

    if (!companyProfileId || !attesterDid || !credentialHash || !credentialType) {
      return res.status(400).json({
        error:
          'companyProfileId, attesterDid, credentialHash, and credentialType are required',
      });
    }

    const result = await contract.registerAttestation(
      companyProfileId,
      attesterDid,
      credentialHash,
      credentialType
    );

    // Extract created AttestationRecord ID
    const createdObjects = (result.objectChanges || []).filter(
      (c: any) => c.type === 'created'
    );
    const recordObj = createdObjects.find((c: any) =>
      'objectType' in c && c.objectType?.includes('AttestationRecord')
    );
    const recordId = recordObj && 'objectId' in recordObj
      ? (recordObj as any).objectId as string
      : null;

    await notarization.recordEvent(
      'CREDENTIAL_ISSUED',
      companyProfileId,
      attesterDid,
      { credentialType, credentialHash, recordId }
    );

    res.json({
      success: true,
      recordId,
      transactionDigest: result.digest,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/attestation/revoke
 * Revoke an attestation record.
 */
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const { attestationRecordId, adminCapId } = req.body;
    if (!attestationRecordId || !adminCapId) {
      return res.status(400).json({
        error: 'attestationRecordId and adminCapId are required',
      });
    }

    const result = await contract.revokeAttestation(
      attestationRecordId,
      adminCapId
    );

    await notarization.recordEvent(
      'CREDENTIAL_REVOKED',
      attestationRecordId,
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
 * GET /api/attestation/:id
 * Get an attestation record by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const record = await contract.getAttestation(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Attestation record not found' });
    }

    res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
