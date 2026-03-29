/**
 * IOTA Identity Service — REAL on-chain DIDs
 *
 * Creates actual Decentralized Identifiers on the IOTA Rebased testnet.
 * Each DID is a real on-chain Identity Object visible on the IOTA explorer.
 *
 * DID format: did:iota:testnet:0x<object_id>
 * Explorer:   https://explorer.iota.org/object/0x<object_id>?network=testnet
 */

import {
  IdentityClient,
  IdentityClientReadOnly,
  IotaDocument,
  JwkMemStore,
  JwsAlgorithm,
  KeyIdMemStore,
  MethodScope,
  Storage,
  StorageSigner,
} from '@iota/identity-wasm/node';
import { getFullnodeUrl, IotaClient } from '@iota/iota-sdk/client';
import { getFaucetHost, requestIotaFromFaucetV0 } from '@iota/iota-sdk/faucet';

// ======== Types ========

export interface CreatedDID {
  did: string;
  objectId: string;
  senderAddress: string;
  explorerUrl: string;
  document: Record<string, any>;
  companyName: string;
  createdAt: string;
}

// ======== State ========

const NETWORK = 'testnet';
const createdDids: CreatedDID[] = [];
let iotaClient: IotaClient | null = null;
let chainId: string | null = null;

async function getIotaClient(): Promise<IotaClient> {
  if (!iotaClient) {
    iotaClient = new IotaClient({ url: getFullnodeUrl(NETWORK) });
  }
  return iotaClient;
}

async function getChainId(): Promise<string> {
  if (!chainId) {
    const client = await getIotaClient();
    chainId = await client.getChainIdentifier();
  }
  return chainId;
}

// ======== DID Creation ========

/**
 * Create a REAL DID on the IOTA testnet.
 *
 * Steps:
 * 1. Generate Ed25519 keypair (this becomes the wallet/signer)
 * 2. Fund the wallet from the testnet faucet
 * 3. Create a DID Document with a verification method
 * 4. Publish the DID on-chain as an Identity Object
 * 5. Return the DID, explorer URL, and document
 */
export async function createDID(companyName: string): Promise<CreatedDID> {
  const client = await getIotaClient();
  const network = await getChainId();

  // 1. Create key storage and signer
  const storage = new Storage(new JwkMemStore(), new KeyIdMemStore());
  const identityClientReadOnly = await IdentityClientReadOnly.create(client);
  const generated = await storage.keyStorage().generate('Ed25519', JwsAlgorithm.EdDSA);
  const publicKeyJwk = generated.jwk().toPublic();
  if (!publicKeyJwk) throw new Error('Failed to generate public key');
  const signer = new StorageSigner(storage, generated.keyId(), publicKeyJwk);
  const identityClient = await IdentityClient.create(identityClientReadOnly, signer);
  const senderAddress = identityClient.senderAddress();

  // 2. Fund the wallet
  await requestIotaFromFaucetV0({
    host: getFaucetHost(NETWORK),
    recipient: senderAddress,
  });

  // Wait for funding to settle
  await new Promise((r) => setTimeout(r, 3000));

  // 3. Create DID document
  const unpublished = new IotaDocument(network);
  await unpublished.generateMethod(
    storage,
    JwkMemStore.ed25519KeyType(),
    JwsAlgorithm.EdDSA,
    '#key-1',
    MethodScope.VerificationMethod(),
  );

  // 4. Publish on-chain
  const { output: identity } = await identityClient
    .createIdentity(unpublished)
    .finish()
    .buildAndExecute(identityClient);

  const did = identity.didDocument().id();
  const didStr = did.toString();

  // 5. Resolve to confirm it's on-chain
  const resolved = await identityClient.resolveDid(did);

  // Extract object ID from DID string
  const parts = didStr.split(':');
  const objectId = parts[parts.length - 1];

  const result: CreatedDID = {
    did: didStr,
    objectId,
    senderAddress,
    explorerUrl: `https://explorer.iota.org/object/${objectId}?network=${NETWORK}`,
    document: resolved as any,
    companyName,
    createdAt: new Date().toISOString(),
  };

  createdDids.push(result);
  return result;
}

/**
 * Resolve an existing DID from the IOTA testnet.
 */
export async function resolveDID(didString: string): Promise<Record<string, any> | null> {
  try {
    const client = await getIotaClient();
    const identityClientReadOnly = await IdentityClientReadOnly.create(client);

    // Import IotaDID to parse the string
    const { IotaDID } = await import('@iota/identity-wasm/node');
    const did = IotaDID.parse(didString);
    const resolved = await identityClientReadOnly.resolveDid(did);
    return resolved as any;
  } catch (err) {
    console.error('Failed to resolve DID:', err);
    return null;
  }
}

/**
 * List all DIDs created in this session.
 */
export function listCreatedDids(): CreatedDID[] {
  return [...createdDids];
}

// Hardcoded demo DID — this was created on-chain and verified via RPC.
// Object type: 0x2227...::identity::Identity on IOTA Rebased testnet.
const DEMO_DID: CreatedDID = {
  did: 'did:iota:testnet:0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369',
  objectId: '0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369',
  senderAddress: '0xcd48685401ee02cf019897f317772dea4c9ffd4ac15bf4a8a32b43bf48b5d15c',
  explorerUrl: 'https://explorer.iota.org/object/0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369?network=testnet',
  document: {
    doc: {
      id: 'did:iota:testnet:0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369',
      verificationMethod: [{
        id: 'did:iota:testnet:0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369#key-1',
        controller: 'did:iota:testnet:0x3de46f837c3f0eb735737e55ed54fd85706163dd5f6345cc5589f18fceab5369',
        type: 'JsonWebKey2020',
        publicKeyJwk: {
          kty: 'OKP',
          alg: 'EdDSA',
          kid: 'ttu-5unvvn_MGkXCj6Gm0tL9Kw9eM4zGHEYabmSlZxA',
          crv: 'Ed25519',
          x: '8jb1cmI9b5UdDfA5kys52dzAdjS1IO_zXWdUqEVWch0',
        },
      }],
    },
    meta: {
      created: '2026-03-29T22:43:20Z',
      updated: '2026-03-29T22:43:20Z',
    },
  },
  companyName: 'Acme Global Labs',
  createdAt: '2026-03-29T22:43:20.964Z',
};

/**
 * Get the pre-created demo DID (Acme Global Labs).
 * Uses hardcoded data (verified on-chain), with file and session fallbacks.
 */
export function getDemoDid(): CreatedDID {
  // 1. Check if we created a new DID in this session
  if (createdDids.length > 0) {
    return createdDids[0];
  }

  // 2. Check if did-result.json exists (from create-real-did script)
  try {
    const fs = require('fs');
    const path = require('path');
    const resultPath = path.join(__dirname, '../../did-result.json');
    if (fs.existsSync(resultPath)) {
      return JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
    }
  } catch {
    // ignore
  }

  // 3. Return the hardcoded demo DID (always works)
  return DEMO_DID;
}
