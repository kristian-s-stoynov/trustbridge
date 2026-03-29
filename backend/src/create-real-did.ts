/**
 * Create a REAL DID on IOTA Rebased Testnet
 *
 * This creates an actual on-chain Identity Object visible on the IOTA explorer.
 *
 * Run: NETWORK_NAME_FAUCET=testnet npx ts-node src/create-real-did.ts
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

const NETWORK = 'testnet';

async function main() {
  console.log('=== Creating REAL DID on IOTA Testnet ===\n');

  // 1. Connect to IOTA testnet
  const rpcUrl = getFullnodeUrl(NETWORK);
  console.log(`1. Connecting to: ${rpcUrl}`);
  const iotaClient = new IotaClient({ url: rpcUrl });
  const network = await iotaClient.getChainIdentifier();
  console.log(`   Chain identifier: ${network}\n`);

  // 2. Create key storage
  console.log('2. Setting up key storage...');
  const storage = new Storage(new JwkMemStore(), new KeyIdMemStore());

  // 3. Create an identity client with a funded wallet
  console.log('3. Creating signer keypair...');
  const identityClientReadOnly = await IdentityClientReadOnly.create(iotaClient);
  const generated = await storage.keyStorage().generate('Ed25519', JwsAlgorithm.EdDSA);
  const publicKeyJwk = generated.jwk().toPublic();
  if (!publicKeyJwk) throw new Error('Failed to get public key');
  const keyId = generated.keyId();
  const signer = new StorageSigner(storage, keyId, publicKeyJwk);
  const identityClient = await IdentityClient.create(identityClientReadOnly, signer);

  const senderAddress = identityClient.senderAddress();
  console.log(`   Sender address: ${senderAddress}`);

  // 4. Fund the wallet from the testnet faucet
  console.log('\n4. Requesting tokens from faucet...');
  try {
    await requestIotaFromFaucetV0({
      host: getFaucetHost(NETWORK),
      recipient: senderAddress,
    });
    console.log('   Funded!');
  } catch (err) {
    console.error('   Faucet error:', err);
    throw err;
  }

  // Wait a moment for funding to settle
  await new Promise((r) => setTimeout(r, 3000));

  // 5. Create a DID document
  console.log('\n5. Creating DID document for "Acme Global Labs"...');
  const unpublished = new IotaDocument(network);

  // Add a verification method (Ed25519 key)
  const fragment = await unpublished.generateMethod(
    storage,
    JwkMemStore.ed25519KeyType(),
    JwsAlgorithm.EdDSA,
    '#key-1',
    MethodScope.VerificationMethod(),
  );
  console.log(`   Verification method fragment: ${fragment}`);

  // 6. Publish the DID document on-chain
  console.log('\n6. Publishing DID on IOTA testnet...');
  const { output: identity } = await identityClient
    .createIdentity(unpublished)
    .finish()
    .buildAndExecute(identityClient);

  const did = identity.didDocument().id();
  console.log(`\n   ✅ DID CREATED: ${did}`);

  // 7. Resolve the DID to verify it exists on-chain
  console.log('\n7. Resolving DID from chain...');
  const resolved = await identityClient.resolveDid(did);
  console.log(`   Resolved successfully!`);
  console.log(`   DID Document:\n${JSON.stringify(resolved, null, 2)}`);

  // 8. Extract the object ID for the explorer link
  const didStr = did.toString();
  // DID format: did:iota:<network_hex>:0x<object_id>
  const parts = didStr.split(':');
  const objectId = parts[parts.length - 1]; // 0x...

  console.log('\n=== RESULTS ===');
  console.log(`DID:        ${didStr}`);
  console.log(`Object ID:  ${objectId}`);
  console.log(`Explorer:   https://explorer.iota.org/object/${objectId}?network=${NETWORK}`);
  console.log(`Sender:     ${senderAddress}`);

  // Save results to a file for the backend to use
  const results = {
    did: didStr,
    objectId,
    senderAddress,
    explorerUrl: `https://explorer.iota.org/object/${objectId}?network=${NETWORK}`,
    document: resolved,
    createdAt: new Date().toISOString(),
    companyName: 'Acme Global Labs',
  };

  const fs = require('fs');
  fs.writeFileSync(
    'did-result.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\nResults saved to did-result.json');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
