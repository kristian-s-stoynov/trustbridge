import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import { Transaction } from '@iota/iota-sdk/transactions';
import { config } from '../config';

let client: IotaClient | null = null;
let adminKeypair: Ed25519Keypair | null = null;

/**
 * Get the IOTA client singleton (connects to testnet).
 */
export function getClient(): IotaClient {
  if (!client) {
    client = new IotaClient({ url: config.rpcUrl });
  }
  return client;
}

/**
 * Get the admin keypair for signing transactions.
 * The admin key is the publisher of the Move package and holds the AdminCap.
 */
export function getAdminKeypair(): Ed25519Keypair {
  if (!adminKeypair) {
    if (!config.adminPrivateKey) {
      throw new Error('ADMIN_PRIVATE_KEY not set in environment');
    }
    // Expects base64-encoded private key
    adminKeypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(config.adminPrivateKey, 'base64')
    );
  }
  return adminKeypair;
}

/**
 * Execute a Move transaction signed by the admin.
 */
export async function executeAdminTransaction(tx: Transaction) {
  const client = getClient();
  const keypair = getAdminKeypair();

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });

  return result;
}

/**
 * Query an on-chain object by its ID.
 */
export async function getObject(objectId: string) {
  const client = getClient();
  return client.getObject({
    id: objectId,
    options: {
      showContent: true,
      showType: true,
    },
  });
}

/**
 * Query events emitted by our package.
 */
export async function queryEvents(eventType: string, limit = 50) {
  const client = getClient();
  return client.queryEvents({
    query: {
      MoveEventType: `${config.packageId}::${eventType}`,
    },
    limit,
    order: 'descending',
  });
}

/**
 * Get the IOTA Clock object ID (shared system object).
 */
export const CLOCK_OBJECT_ID = '0x6';
