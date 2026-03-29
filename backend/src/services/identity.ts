/**
 * IOTA Identity Service
 *
 * Handles DID creation, Verifiable Credential issuance, and verification
 * using IOTA Identity (W3C DID + VC standards on IOTA Rebased).
 *
 * KEY CONCEPT — DID ↔ Wallet relationship:
 *   On IOTA Rebased, a DID is stored as an on-chain "Identity Object."
 *   That object is OWNED by an IOTA address (wallet).
 *   So every DID has a controlling wallet address.
 *
 *   Flow: Ed25519Keypair → IOTA Address → creates Identity Object → DID
 *
 * For the hackathon MVP, we generate real Ed25519 keypairs and derive
 * real IOTA addresses, so the frontend can display wallet ↔ DID links.
 * The DID itself is simulated (not published on-chain) but the keypair
 * and address are cryptographically valid.
 */

import { createHash } from 'crypto';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';

// ======== Types ========

export interface CompanyDID {
  did: string;
  address: string;          // IOTA wallet address that controls this DID
  publicKey: string;         // Ed25519 public key (hex)
  document: Record<string, any>;
}

export interface VerifiableCredentialJWT {
  jwt: string;
  hash: string; // SHA-256 hash of the JWT
}

export interface CredentialVerificationResult {
  isValid: boolean;
  issuerDid: string;
  subjectDid: string;
  credentialType: string;
  issuedAt: string;
  error?: string;
}

// ======== In-memory store (hackathon MVP) ========

// In production, DIDs are on-chain and VCs are stored by holders.
// For the hackathon, we keep an in-memory registry for quick lookups.
const didStore = new Map<string, CompanyDID>();
const vcStore = new Map<string, string>(); // hash → JWT
const addressToDid = new Map<string, string>(); // address → DID

// ======== DID Operations ========

/**
 * Create a new DID for a company on IOTA.
 *
 * How it works on IOTA Rebased (production):
 *   1. Generate Ed25519Keypair → this is the "wallet"
 *   2. Derive the IOTA address from the public key
 *   3. Publish an Identity Object on-chain using @iota/identity-wasm
 *   4. The DID becomes did:iota:<network>:0x<identity_object_id>
 *   5. The wallet address OWNS the Identity Object (can update/delete it)
 *
 * For the hackathon MVP:
 *   - We generate a REAL Ed25519 keypair and derive a REAL IOTA address
 *   - The DID is simulated (we use the address as the object ID placeholder)
 *   - This gives the frontend a real wallet address to display
 *
 * @param companyName - Legal name of the company or authority
 * @param walletAddress - Optional: link to an existing wallet address instead of generating one
 */
export async function createDID(
  companyName: string,
  walletAddress?: string
): Promise<CompanyDID> {
  let address: string;
  let publicKeyHex: string;

  if (walletAddress) {
    // Link to an existing wallet address (e.g., from frontend wallet connection)
    address = walletAddress;
    publicKeyHex = 'linked-externally';
  } else {
    // Generate a new Ed25519 keypair (this IS a real IOTA wallet)
    const keypair = new Ed25519Keypair();
    address = keypair.toIotaAddress();
    publicKeyHex = Buffer.from(keypair.getPublicKey().toRawBytes()).toString('hex');
  }

  // On IOTA Rebased, the DID references the on-chain Identity Object.
  // The Identity Object ID is derived from the creating transaction.
  // For MVP, we use a hash that incorporates the address to maintain the link.
  const objectIdHash = createHash('sha256')
    .update(`${address}-${companyName}-${Date.now()}`)
    .digest('hex');

  const did = `did:iota:testnet:0x${objectIdHash}`;

  const document = {
    id: did,
    '@context': ['https://www.w3.org/ns/did/v1'],
    // The controller is the wallet address that owns this DID
    controller: address,
    verificationMethod: [
      {
        id: `${did}#key-1`,
        type: 'Ed25519VerificationKey2018',
        controller: did,
        publicKeyMultibase: `z${publicKeyHex}`,
      },
    ],
    authentication: [`${did}#key-1`],
    service: [
      {
        id: `${did}#trustbridge`,
        type: 'TrustBridgeProfile',
        serviceEndpoint: `https://trustbridge.io/profile/${objectIdHash.slice(0, 16)}`,
      },
    ],
  };

  const companyDid: CompanyDID = {
    did,
    address,
    publicKey: publicKeyHex,
    document,
  };

  didStore.set(did, companyDid);
  addressToDid.set(address, did);

  return companyDid;
}

/**
 * Resolve a DID to its full record (including wallet address).
 */
export async function resolveDID(did: string): Promise<CompanyDID | null> {
  return didStore.get(did) || null;
}

/**
 * Look up a DID by its controlling wallet address.
 * This is how the frontend answers: "what DID does this wallet own?"
 */
export async function resolveByAddress(address: string): Promise<CompanyDID | null> {
  const did = addressToDid.get(address);
  if (!did) return null;
  return didStore.get(did) || null;
}

// ======== Verifiable Credential Operations ========

/**
 * Issue a Verifiable Credential from an attester to a company.
 *
 * In production: uses identity_credential to sign a JWT with the attester's key.
 * For MVP: creates a structured VC and returns it as a signed-like JWT.
 */
export async function issueCredential(
  issuerDid: string,
  subjectDid: string,
  credentialType: string,
  claims: Record<string, any>
): Promise<VerifiableCredentialJWT> {
  const now = new Date().toISOString();

  // Resolve both DIDs to get their wallet addresses
  const issuer = await resolveDID(issuerDid);
  const subject = await resolveDID(subjectDid);

  // Build the VC payload (W3C VC Data Model)
  const vcPayload = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://trustbridge.io/credentials/v1',
    ],
    type: ['VerifiableCredential', credentialType],
    issuer: {
      id: issuerDid,
      // Include the issuer's wallet address so the credential links back to their wallet
      controller: issuer?.address || 'unknown',
    },
    issuanceDate: now,
    credentialSubject: {
      id: subjectDid,
      // Include the subject's wallet address
      controller: subject?.address || 'unknown',
      ...claims,
    },
    credentialStatus: {
      id: `${issuerDid}#revocation`,
      type: 'RevocationBitmap2022',
    },
  };

  // In production: sign with issuer's Ed25519 key → JWT
  // For MVP: base64-encode the payload as a simulated JWT
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(vcPayload)).toString('base64url');
  const signature = createHash('sha256')
    .update(`${header}.${payload}`)
    .digest('base64url');

  const jwt = `${header}.${payload}.${signature}`;

  // Hash the JWT for on-chain anchoring
  const hash = createHash('sha256').update(jwt).digest('hex');

  vcStore.set(hash, jwt);

  return { jwt, hash };
}

/**
 * Verify a Verifiable Credential JWT.
 *
 * In production: resolves issuer DID, validates signature, checks revocation.
 * For MVP: decodes and validates structure.
 */
export async function verifyCredential(
  jwt: string
): Promise<CredentialVerificationResult> {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      return {
        isValid: false,
        issuerDid: '',
        subjectDid: '',
        credentialType: '',
        issuedAt: '',
        error: 'Invalid JWT format',
      };
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    // Verify signature (in production: Ed25519 signature verification)
    const expectedSig = createHash('sha256')
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64url');

    const signatureValid = parts[2] === expectedSig;

    // Resolve issuer DID (check it exists)
    // Handle both string issuer and object issuer { id, controller }
    const issuerDid = typeof payload.issuer === 'string'
      ? payload.issuer
      : payload.issuer?.id || '';

    const issuerDoc = await resolveDID(issuerDid);

    return {
      isValid: signatureValid && issuerDoc !== null,
      issuerDid,
      subjectDid: payload.credentialSubject?.id || '',
      credentialType: payload.type?.[1] || 'Unknown',
      issuedAt: payload.issuanceDate || '',
      error: !signatureValid
        ? 'Invalid signature'
        : !issuerDoc
          ? 'Issuer DID not found'
          : undefined,
    };
  } catch (err) {
    return {
      isValid: false,
      issuerDid: '',
      subjectDid: '',
      credentialType: '',
      issuedAt: '',
      error: `Verification failed: ${err}`,
    };
  }
}

/**
 * Get the SHA-256 hash of a VC JWT (for on-chain anchoring).
 */
export function hashCredential(jwt: string): string {
  return createHash('sha256').update(jwt).digest('hex');
}

/**
 * List all DIDs (hackathon demo helper).
 */
export function listDIDs(): Array<{
  did: string;
  address: string;
  publicKey: string;
  document: Record<string, any>;
}> {
  return Array.from(didStore.values()).map((entry) => ({
    did: entry.did,
    address: entry.address,
    publicKey: entry.publicKey,
    document: entry.document,
  }));
}

/**
 * List all issued VCs (hackathon demo helper).
 */
export function listCredentials(): Array<{ hash: string; jwt: string }> {
  return Array.from(vcStore.entries()).map(([hash, jwt]) => ({
    hash,
    jwt,
  }));
}
