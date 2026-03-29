/**
 * Demo Contract Service
 *
 * Simulates on-chain Move contract behavior in-memory.
 * Used when PACKAGE_ID is not set (contracts not deployed).
 *
 * All responses mirror the real contract service shape exactly,
 * so the routes don't need to change.
 */

import { createHash } from 'crypto';
import type {
  TrustProfileData,
  AttestationRecordData,
  StakePoolData,
} from '../types';

// ======== In-memory stores ========

const profiles = new Map<string, TrustProfileData>();
const attestations = new Map<string, AttestationRecordData>();
let stakePool: StakePoolData = {
  id: '0x' + 'pool'.padEnd(64, '0'),
  minStake: 1_000_000_000, // 1 IOTA in nanos
  totalStaked: 0,
  totalStakers: 0,
  slashedFundsAmount: 0,
};
const stakes = new Map<string, number>(); // profileId → staked amount in nanos

let txCounter = 0;

function mockObjectId(): string {
  const hash = createHash('sha256')
    .update(`obj-${Date.now()}-${txCounter++}-${Math.random()}`)
    .digest('hex');
  return `0x${hash}`;
}

function mockDigest(): string {
  return createHash('sha256')
    .update(`tx-${Date.now()}-${txCounter++}`)
    .digest('hex')
    .slice(0, 44);
}

function mockTxResult(objectType: string, objectId: string) {
  return {
    digest: mockDigest(),
    objectChanges: [
      {
        type: 'created' as const,
        objectType,
        objectId,
      },
    ],
  };
}

// ======== Trust Profile ========

export async function createProfile(
  companyName: string,
  domain: string,
  did: string
) {
  const id = mockObjectId();
  const profile: TrustProfileData = {
    id,
    companyName,
    domain,
    did,
    trustStars: 0,
    isVerified: false,
    isStaked: false,
    isProven: false,
    isVouched: false,
    completedDeals: 0,
    createdAt: Date.now(),
    isSlashed: false,
  };
  profiles.set(id, profile);
  return mockTxResult('trustbridge::trust_profile::TrustProfile', id);
}

export async function markVerified(profileId: string, _adminCapId: string) {
  const p = profiles.get(profileId);
  if (!p) throw new Error(`Profile ${profileId} not found`);
  if (p.isSlashed) throw new Error('Cannot verify a slashed profile');
  if (!p.isVerified) {
    p.isVerified = true;
    p.trustStars++;
  }
  return { digest: mockDigest(), objectChanges: [] };
}

export async function recordDeal(profileId: string, _adminCapId: string) {
  const p = profiles.get(profileId);
  if (!p) throw new Error(`Profile ${profileId} not found`);
  if (p.isSlashed) throw new Error('Cannot record deal for a slashed profile');
  p.completedDeals++;
  if (p.completedDeals >= 3 && !p.isProven) {
    p.isProven = true;
    p.trustStars++;
  }
  return { digest: mockDigest(), objectChanges: [] };
}

export async function markVouched(profileId: string, _adminCapId: string) {
  const p = profiles.get(profileId);
  if (!p) throw new Error(`Profile ${profileId} not found`);
  if (!p.isVouched) {
    p.isVouched = true;
    p.trustStars++;
  }
  return { digest: mockDigest(), objectChanges: [] };
}

export async function slashProfile(profileId: string, _adminCapId: string) {
  const p = profiles.get(profileId);
  if (!p) throw new Error(`Profile ${profileId} not found`);
  p.isSlashed = true;
  p.trustStars = 0;
  p.isVerified = false;
  p.isStaked = false;
  p.isProven = false;
  p.isVouched = false;
  return { digest: mockDigest(), objectChanges: [] };
}

export async function getProfile(profileId: string): Promise<TrustProfileData | null> {
  return profiles.get(profileId) || null;
}

// ======== Staking ========

export async function stake(profileId: string, amountInIota: number) {
  const p = profiles.get(profileId);
  if (!p) throw new Error(`Profile ${profileId} not found`);
  if (p.isSlashed) throw new Error('Cannot stake for a slashed profile');

  const amountNanos = amountInIota * 1_000_000_000;
  if (amountNanos < stakePool.minStake) {
    throw new Error(`Minimum stake is ${stakePool.minStake / 1_000_000_000} IOTA`);
  }

  const existing = stakes.get(profileId) || 0;
  if (existing === 0) {
    stakePool.totalStakers++;
  }
  stakes.set(profileId, existing + amountNanos);
  stakePool.totalStaked += amountNanos;

  if (!p.isStaked) {
    p.isStaked = true;
    p.trustStars++;
  }

  return { digest: mockDigest(), objectChanges: [] };
}

export async function unstake(profileId: string) {
  const p = profiles.get(profileId);
  if (!p) throw new Error(`Profile ${profileId} not found`);
  if (p.isSlashed) throw new Error('Cannot unstake a slashed profile');

  const staked = stakes.get(profileId) || 0;
  if (staked === 0) throw new Error('No stake to withdraw');

  stakePool.totalStaked -= staked;
  stakePool.totalStakers--;
  stakes.delete(profileId);

  if (p.isStaked) {
    p.isStaked = false;
    p.trustStars = Math.max(0, p.trustStars - 1);
  }

  return { digest: mockDigest(), objectChanges: [] };
}

export async function slashStake(
  _stakerAddress: string,
  profileId: string,
  _adminCapId: string
) {
  const staked = stakes.get(profileId) || 0;
  if (staked > 0) {
    stakePool.totalStaked -= staked;
    stakePool.totalStakers--;
    stakePool.slashedFundsAmount += staked;
    stakes.delete(profileId);
  }

  // Also slash the profile
  const p = profiles.get(profileId);
  if (p) {
    p.isSlashed = true;
    p.trustStars = 0;
    p.isVerified = false;
    p.isStaked = false;
    p.isProven = false;
    p.isVouched = false;
  }

  return { digest: mockDigest(), objectChanges: [] };
}

export async function getStakePool(): Promise<StakePoolData | null> {
  return { ...stakePool };
}

// ======== Attestation Registry ========

export async function registerAttestation(
  companyProfileId: string,
  attesterDid: string,
  credentialHash: string,
  credentialType: string
) {
  const id = mockObjectId();
  const record: AttestationRecordData = {
    id,
    companyProfileId,
    attesterDid,
    credentialHash,
    credentialType,
    issuedAt: Date.now(),
    revoked: false,
    revokedAt: 0,
  };
  attestations.set(id, record);
  return mockTxResult('trustbridge::attestation_registry::AttestationRecord', id);
}

export async function revokeAttestation(
  attestationRecordId: string,
  _adminCapId: string
) {
  const record = attestations.get(attestationRecordId);
  if (!record) throw new Error(`Attestation record ${attestationRecordId} not found`);
  record.revoked = true;
  record.revokedAt = Date.now();
  return { digest: mockDigest(), objectChanges: [] };
}

export async function getAttestation(recordId: string): Promise<AttestationRecordData | null> {
  return attestations.get(recordId) || null;
}

// ======== Voucher ========

export async function createVouch(
  fromProfileId: string,
  toProfileId: string,
  message: string
) {
  const id = mockObjectId();
  return mockTxResult('trustbridge::voucher::Voucher', id);
}

// ======== Demo Helpers ========

export function listProfiles(): TrustProfileData[] {
  return Array.from(profiles.values());
}

export function listAttestations(): AttestationRecordData[] {
  return Array.from(attestations.values());
}
