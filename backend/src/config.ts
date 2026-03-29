import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // IOTA network
  network: process.env.IOTA_NETWORK || 'testnet',
  rpcUrl: process.env.IOTA_RPC_URL || 'https://api.testnet.iota.cafe:443',
  faucetUrl: process.env.IOTA_FAUCET_URL || 'https://faucet.testnet.iota.cafe',

  // Deployed contract addresses (set after publishing)
  packageId: process.env.PACKAGE_ID || '',
  stakePoolId: process.env.STAKE_POOL_ID || '',

  // Admin key
  adminPrivateKey: process.env.ADMIN_PRIVATE_KEY || '',

  // Server
  port: parseInt(process.env.PORT || '3001', 10),
};
