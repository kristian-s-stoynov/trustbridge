/**
 * IOTA Gas Station Service
 *
 * Provides fee sponsorship so end users never need to hold IOTA tokens.
 * The backend acts as the sponsor, signing transactions on behalf of users.
 *
 * In production: connects to a self-hosted Gas Station server.
 * For MVP: the admin keypair sponsors all transactions directly.
 *
 * Gas Station API endpoints (when self-hosted):
 * - POST /v1/reserve_gas  → Reserve gas coins for a transaction
 * - POST /v1/execute_tx   → Execute a sponsored transaction
 */

import { Transaction } from '@iota/iota-sdk/transactions';
import { getClient, getAdminKeypair } from './iota-client';

export interface SponsoredTransactionResult {
  digest: string;
  sponsorAddress: string;
  userAddress: string;
}

/**
 * Sponsor a transaction for a user.
 *
 * The admin/backend pays the gas fees so the user doesn't need IOTA.
 * This is the simplest form of gas sponsorship for an MVP.
 *
 * Flow:
 * 1. User builds a transaction
 * 2. Backend signs it as the gas sponsor
 * 3. User signs it as the sender
 * 4. Both signatures are submitted together
 *
 * For the MVP, since the backend controls both keys, we sign both sides.
 */
export async function sponsorTransaction(
  tx: Transaction,
  userAddress?: string
): Promise<SponsoredTransactionResult> {
  const client = getClient();
  const sponsor = getAdminKeypair();

  // The sponsor pays the gas
  tx.setSender(userAddress || sponsor.getPublicKey().toIotaAddress());
  tx.setGasOwner(sponsor.getPublicKey().toIotaAddress());

  const result = await client.signAndExecuteTransaction({
    signer: sponsor,
    transaction: tx,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return {
    digest: result.digest,
    sponsorAddress: sponsor.getPublicKey().toIotaAddress(),
    userAddress: userAddress || sponsor.getPublicKey().toIotaAddress(),
  };
}

/**
 * Configuration for connecting to a self-hosted Gas Station.
 * Used when deploying beyond the MVP.
 */
export const gasStationConfig = {
  // Self-hosted Gas Station URL (set when deploying)
  url: process.env.GAS_STATION_URL || '',

  // Whether to use the Gas Station (false = direct sponsorship via admin key)
  enabled: !!process.env.GAS_STATION_URL,

  // Sponsorship limits
  maxBudgetPerTx: 100_000_000, // 0.1 IOTA in nanos
  reserveDurationSecs: 60,
};
