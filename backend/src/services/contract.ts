import { Transaction } from '@iota/iota-sdk/transactions';
import { config } from '../config';
import {
  executeAdminTransaction,
  getClient,
  getObject,
  getAdminKeypair,
  CLOCK_OBJECT_ID,
} from './iota-client';
import type {
  TrustProfileData,
  AttestationRecordData,
  StakePoolData,
} from '../types';

const pkg = () => config.packageId;

// ======== Trust Profile ========

/**
 * Create a trust profile on-chain.
 * Returns the transaction result with the new profile's object ID.
 */
export async function createProfile(
  companyName: string,
  domain: string,
  did: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg()}::trust_profile::create_profile`,
    arguments: [
      tx.pure.string(companyName),
      tx.pure.string(domain),
      tx.pure.string(did),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return executeAdminTransaction(tx);
}

/**
 * Mark a profile as verified (★).
 * Requires admin to pass their AdminCap object ID.
 */
export async function markVerified(profileId: string, adminCapId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg()}::trust_profile::mark_verified`,
    arguments: [tx.object(profileId), tx.object(adminCapId)],
  });

  return executeAdminTransaction(tx);
}

/**
 * Record a completed deal for a company.
 */
export async function recordDeal(profileId: string, adminCapId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg()}::trust_profile::record_deal`,
    arguments: [tx.object(profileId), tx.object(adminCapId)],
  });

  return executeAdminTransaction(tx);
}

/**
 * Mark a profile as vouched (★★★★).
 */
export async function markVouched(profileId: string, adminCapId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg()}::trust_profile::mark_vouched`,
    arguments: [tx.object(profileId), tx.object(adminCapId)],
  });

  return executeAdminTransaction(tx);
}

/**
 * Slash a fraudulent company's profile.
 */
export async function slashProfile(profileId: string, adminCapId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg()}::trust_profile::slash`,
    arguments: [tx.object(profileId), tx.object(adminCapId)],
  });

  return executeAdminTransaction(tx);
}

/**
 * Query a TrustProfile object and parse its fields.
 */
export async function getProfile(profileId: string): Promise<TrustProfileData | null> {
  const result = await getObject(profileId);
  if (!result.data?.content || result.data.content.dataType !== 'moveObject') {
    return null;
  }

  const fields = result.data.content.fields as Record<string, any>;
  return {
    id: profileId,
    companyName: fields.company_name,
    domain: fields.domain,
    did: fields.did,
    trustStars: Number(fields.trust_stars),
    isVerified: fields.is_verified,
    isStaked: fields.is_staked,
    isProven: fields.is_proven,
    isVouched: fields.is_vouched,
    completedDeals: Number(fields.completed_deals),
    createdAt: Number(fields.created_at),
    isSlashed: fields.is_slashed,
  };
}

// ======== Staking ========

/**
 * Stake IOTA tokens for a company.
 * amount is in IOTA (will be converted to nanos internally).
 */
export async function stake(
  profileId: string,
  amountInIota: number
) {
  const amountNanos = BigInt(amountInIota) * BigInt(1_000_000_000);
  const keypair = getAdminKeypair();
  const client = getClient();

  const tx = new Transaction();

  // Split the required amount from the gas coin
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountNanos)]);

  tx.moveCall({
    target: `${pkg()}::staking::stake`,
    arguments: [
      tx.object(config.stakePoolId),
      coin,
      tx.object(profileId),
    ],
  });

  return executeAdminTransaction(tx);
}

/**
 * Unstake tokens for a company.
 */
export async function unstake(profileId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg()}::staking::unstake`,
    arguments: [
      tx.object(config.stakePoolId),
      tx.object(profileId),
    ],
  });

  return executeAdminTransaction(tx);
}

/**
 * Admin slashes a company's stake by address.
 */
export async function slashStake(
  stakerAddress: string,
  profileId: string,
  adminCapId: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg()}::staking::slash_stake_by_address`,
    arguments: [
      tx.object(config.stakePoolId),
      tx.pure.address(stakerAddress),
      tx.object(profileId),
      tx.object(adminCapId),
    ],
  });

  return executeAdminTransaction(tx);
}

/**
 * Query StakePool stats.
 */
export async function getStakePool(): Promise<StakePoolData | null> {
  const result = await getObject(config.stakePoolId);
  if (!result.data?.content || result.data.content.dataType !== 'moveObject') {
    return null;
  }

  const fields = result.data.content.fields as Record<string, any>;
  return {
    id: config.stakePoolId,
    minStake: Number(fields.min_stake),
    totalStaked: Number(fields.total_staked),
    totalStakers: Number(fields.total_stakers),
    slashedFundsAmount: Number(fields.slashed_funds),
  };
}

// ======== Attestation Registry ========

/**
 * Register an attestation record on-chain.
 */
export async function registerAttestation(
  companyProfileId: string,
  attesterDid: string,
  credentialHash: string,
  credentialType: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg()}::attestation_registry::register_attestation`,
    arguments: [
      tx.pure.id(companyProfileId),
      tx.pure.string(attesterDid),
      tx.pure.vector('u8', Array.from(Buffer.from(credentialHash, 'hex'))),
      tx.pure.string(credentialType),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return executeAdminTransaction(tx);
}

/**
 * Revoke an attestation record.
 */
export async function revokeAttestation(
  attestationRecordId: string,
  adminCapId: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg()}::attestation_registry::revoke_attestation`,
    arguments: [
      tx.object(attestationRecordId),
      tx.object(adminCapId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return executeAdminTransaction(tx);
}

/**
 * Query an AttestationRecord.
 */
export async function getAttestation(recordId: string): Promise<AttestationRecordData | null> {
  const result = await getObject(recordId);
  if (!result.data?.content || result.data.content.dataType !== 'moveObject') {
    return null;
  }

  const fields = result.data.content.fields as Record<string, any>;
  return {
    id: recordId,
    companyProfileId: fields.company_profile_id,
    attesterDid: fields.attester_did,
    credentialHash: Buffer.from(fields.credential_hash).toString('hex'),
    credentialType: fields.credential_type,
    issuedAt: Number(fields.issued_at),
    revoked: fields.revoked,
    revokedAt: Number(fields.revoked_at),
  };
}

// ======== Voucher ========

/**
 * Create a vouch from one company to another.
 */
export async function createVouch(
  fromProfileId: string,
  toProfileId: string,
  message: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg()}::voucher::vouch`,
    arguments: [
      tx.pure.id(fromProfileId),
      tx.pure.id(toProfileId),
      tx.pure.string(message),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return executeAdminTransaction(tx);
}
