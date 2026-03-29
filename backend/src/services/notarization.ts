/**
 * IOTA Notarization Service
 *
 * Creates tamper-evident audit trail entries for trust events.
 * Uses IOTA Notarization (Dynamic Notarization) to record events
 * with stable on-chain object IDs.
 *
 * For the MVP, we maintain an in-memory audit log and anchor
 * hashes on-chain via the attestation_registry contract.
 * In production, this would use the @iota/notarization-wasm bindings.
 */

import { createHash } from 'crypto';

// ======== Types ========

export interface AuditEntry {
  id: string;
  eventType: AuditEventType;
  subjectProfileId: string;
  actorDid: string;
  timestamp: string;
  dataHash: string;
  details: Record<string, any>;
}

export type AuditEventType =
  | 'PROFILE_CREATED'
  | 'CREDENTIAL_ISSUED'
  | 'CREDENTIAL_REVOKED'
  | 'STAKE_DEPOSITED'
  | 'STAKE_WITHDRAWN'
  | 'STAKE_SLASHED'
  | 'DEAL_RECORDED'
  | 'VOUCH_CREATED'
  | 'PROFILE_VERIFIED'
  | 'PROFILE_SLASHED';

// ======== In-memory audit log ========

const auditLog: AuditEntry[] = [];

/**
 * Record a trust event in the audit trail.
 *
 * In production: creates/updates a Dynamic Notarization object on IOTA
 * with the event hash, providing a tamper-evident on-chain record.
 *
 * For MVP: stores in memory and returns the entry with its hash.
 */
export async function recordEvent(
  eventType: AuditEventType,
  subjectProfileId: string,
  actorDid: string,
  details: Record<string, any> = {}
): Promise<AuditEntry> {
  const timestamp = new Date().toISOString();

  // Create a deterministic hash of the event data
  const dataHash = createHash('sha256')
    .update(
      JSON.stringify({
        eventType,
        subjectProfileId,
        actorDid,
        timestamp,
        details,
        previousHash: auditLog.length > 0
          ? auditLog[auditLog.length - 1].dataHash
          : '0000000000000000000000000000000000000000000000000000000000000000',
      })
    )
    .digest('hex');

  const entry: AuditEntry = {
    id: `audit-${auditLog.length + 1}`,
    eventType,
    subjectProfileId,
    actorDid,
    timestamp,
    dataHash,
    details,
  };

  auditLog.push(entry);

  // In production: anchor this hash on-chain via IOTA Notarization
  // await notarizationClient.updateDynamicNotarization(objectId, dataHash);

  return entry;
}

/**
 * Get the full audit trail for a profile.
 */
export function getAuditTrail(profileId: string): AuditEntry[] {
  return auditLog.filter((entry) => entry.subjectProfileId === profileId);
}

/**
 * Get the full audit log.
 */
export function getFullAuditLog(): AuditEntry[] {
  return [...auditLog];
}

/**
 * Verify the integrity of the audit chain.
 * Each entry's hash should incorporate the previous entry's hash.
 */
export function verifyAuditChainIntegrity(): {
  isValid: boolean;
  brokenAt?: number;
} {
  for (let i = 0; i < auditLog.length; i++) {
    const entry = auditLog[i];
    const previousHash =
      i > 0
        ? auditLog[i - 1].dataHash
        : '0000000000000000000000000000000000000000000000000000000000000000';

    const expectedHash = createHash('sha256')
      .update(
        JSON.stringify({
          eventType: entry.eventType,
          subjectProfileId: entry.subjectProfileId,
          actorDid: entry.actorDid,
          timestamp: entry.timestamp,
          details: entry.details,
          previousHash,
        })
      )
      .digest('hex');

    if (entry.dataHash !== expectedHash) {
      return { isValid: false, brokenAt: i };
    }
  }

  return { isValid: true };
}
