/**
 * Contract Proxy
 *
 * Auto-selects between real on-chain contracts and demo mode.
 * If PACKAGE_ID is set → uses real IOTA contracts.
 * If not → uses in-memory demo simulation.
 *
 * All routes import from this file, so they work in both modes.
 */

import { config } from '../config';

const isDemo = !config.packageId;

export const mode = isDemo ? 'demo' : 'live';

if (isDemo) {
  console.log('⚡ Running in DEMO mode (no PACKAGE_ID set)');
  console.log('   All on-chain operations are simulated in-memory.');
  console.log('   Set PACKAGE_ID in .env to connect to real IOTA contracts.');
} else {
  console.log('🔗 Running in LIVE mode (connected to IOTA)');
}

// Re-export all functions from the selected module
// This way routes can do: import * as contract from './contract-proxy'
// and call contract.createProfile(...) etc.

const mod = isDemo
  ? require('./contract-demo')
  : require('./contract');

export const createProfile = mod.createProfile;
export const markVerified = mod.markVerified;
export const recordDeal = mod.recordDeal;
export const markVouched = mod.markVouched;
export const slashProfile = mod.slashProfile;
export const getProfile = mod.getProfile;
export const stake = mod.stake;
export const unstake = mod.unstake;
export const slashStake = mod.slashStake;
export const getStakePool = mod.getStakePool;
export const registerAttestation = mod.registerAttestation;
export const revokeAttestation = mod.revokeAttestation;
export const getAttestation = mod.getAttestation;
export const createVouch = mod.createVouch;
