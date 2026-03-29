/**
 * TrustBridge Demo Script
 *
 * Walks through the full trust lifecycle:
 * 1. Attester gets accredited (DID created)
 * 2. Company creates profile (DID + on-chain TrustProfile)
 * 3. Attester issues credential → ★ Verified
 * 4. Company stakes tokens → ★★ Staked
 * 5. Deals recorded → ★★★ Proven
 * 6. Verifier checks profile
 * 7. Revocation event
 * 8. Slash event
 *
 * Run: npx ts-node src/demo.ts
 */

import * as identityService from './services/identity';
import * as notarization from './services/notarization';

async function runDemo() {
  console.log('='.repeat(60));
  console.log('  TrustBridge — Demo Flow');
  console.log('='.repeat(60));
  console.log();

  // ─── Step 1: Create Attester DID ───
  console.log('▸ Step 1: Attester creates DID');
  const attester = await identityService.createDID('Government Registry Authority');
  console.log(`  Attester DID: ${attester.did}`);
  console.log();

  // ─── Step 2: Company creates profile ───
  console.log('▸ Step 2: Company creates trust profile');
  const company = await identityService.createDID('Acme Corp');
  console.log(`  Company DID: ${company.did}`);

  // In production, this also calls the Move contract to create a TrustProfile
  const mockProfileId = '0x' + 'a'.repeat(64);
  await notarization.recordEvent('PROFILE_CREATED', mockProfileId, company.did, {
    companyName: 'Acme Corp',
    domain: 'acme.com',
  });
  console.log(`  Profile ID: ${mockProfileId}`);
  console.log('  Trust Stars: ☆☆☆☆ (0/4)');
  console.log();

  // ─── Step 3: Attester issues credential → ★ Verified ───
  console.log('▸ Step 3: Attester issues Verifiable Credential');
  const vc = await identityService.issueCredential(
    attester.did,
    company.did,
    'BusinessRegistrationCredential',
    {
      registrationNumber: 'REG-2024-12345',
      jurisdiction: 'EU',
      incorporationDate: '2020-06-15',
      legalName: 'Acme Corporation Ltd.',
    }
  );
  console.log(`  Credential Type: BusinessRegistrationCredential`);
  console.log(`  Credential Hash: ${vc.hash.slice(0, 16)}...`);

  await notarization.recordEvent('PROFILE_VERIFIED', mockProfileId, attester.did, {
    credentialType: 'BusinessRegistrationCredential',
    credentialHash: vc.hash,
  });
  console.log('  Trust Stars: ★☆☆☆ (1/4) — Verified!');
  console.log();

  // ─── Step 4: Company stakes tokens → ★★ Staked ───
  console.log('▸ Step 4: Company stakes 10 IOTA as collateral');
  await notarization.recordEvent('STAKE_DEPOSITED', mockProfileId, company.did, {
    amount: 10,
    currency: 'IOTA',
  });
  console.log('  Staked: 10 IOTA (locked in escrow)');
  console.log('  Trust Stars: ★★☆☆ (2/4) — Verified + Staked!');
  console.log();

  // ─── Step 5: Record deals → ★★★ Proven ───
  console.log('▸ Step 5: Recording completed deals');
  for (let i = 1; i <= 3; i++) {
    await notarization.recordEvent('DEAL_RECORDED', mockProfileId, company.did, {
      dealNumber: i,
      counterparty: `Partner ${i}`,
    });
    console.log(`  Deal #${i} completed`);
  }
  console.log('  Trust Stars: ★★★☆ (3/4) — Verified + Staked + Proven!');
  console.log();

  // ─── Step 6: Verifier checks profile ───
  console.log('▸ Step 6: Verifier checks company profile');
  const verification = await identityService.verifyCredential(vc.jwt);
  console.log(`  Credential valid: ${verification.isValid}`);
  console.log(`  Issuer: ${verification.issuerDid.slice(0, 30)}...`);
  console.log(`  Type: ${verification.credentialType}`);

  const trail = notarization.getAuditTrail(mockProfileId);
  console.log(`  Audit trail entries: ${trail.length}`);
  console.log(`  Audit chain integrity: ${notarization.verifyAuditChainIntegrity().isValid ? 'VALID' : 'BROKEN'}`);
  console.log();

  // ─── Step 7: Revocation event ───
  console.log('▸ Step 7: Attester revokes credential (company failed compliance)');
  await notarization.recordEvent('CREDENTIAL_REVOKED', mockProfileId, attester.did, {
    reason: 'Failed annual compliance review',
    credentialHash: vc.hash,
  });
  console.log('  Credential REVOKED');
  console.log('  Trust Stars: ★★☆☆ → Verified star removed');
  console.log();

  // ─── Step 8: Slash event ───
  console.log('▸ Step 8: Platform slashes fraudulent company');
  await notarization.recordEvent('STAKE_SLASHED', mockProfileId, 'platform-admin', {
    reason: 'Fraudulent business practices reported',
    slashedAmount: 10,
  });
  await notarization.recordEvent('PROFILE_SLASHED', mockProfileId, 'platform-admin', {});
  console.log('  Stake SLASHED: 10 IOTA confiscated');
  console.log('  Profile SLASHED: All trust stars revoked');
  console.log('  Trust Stars: ☆☆☆☆ (0/4) — SLASHED');
  console.log();

  // ─── Summary ───
  console.log('='.repeat(60));
  console.log('  Demo Complete — Full Audit Trail');
  console.log('='.repeat(60));
  const fullTrail = notarization.getAuditTrail(mockProfileId);
  fullTrail.forEach((entry, i) => {
    console.log(`  ${i + 1}. [${entry.eventType}] ${entry.timestamp}`);
    console.log(`     Hash: ${entry.dataHash.slice(0, 24)}...`);
  });
  console.log();
  console.log(`  Chain integrity: ${notarization.verifyAuditChainIntegrity().isValid ? '✓ VALID' : '✗ BROKEN'}`);
  console.log(`  Total events: ${fullTrail.length}`);
  console.log();
}

runDemo().catch(console.error);
