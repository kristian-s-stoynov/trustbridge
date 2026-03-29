import express from 'express';
import cors from 'cors';
import { config } from './config';
import { mode } from './services/contract-proxy';

import identityRoutes from './routes/identity';
import profileRoutes from './routes/profile';
import stakingRoutes from './routes/staking';
import attestationRoutes from './routes/attestation';
import auditRoutes from './routes/audit';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/identity', identityRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/staking', stakingRoutes);
app.use('/api/attestation', attestationRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode, // 'demo' or 'live'
    network: config.network,
    packageId: config.packageId || 'NOT_DEPLOYED',
    stakePoolId: config.stakePoolId || 'NOT_DEPLOYED',
  });
});

// Demo helpers — list all profiles (only in demo mode)
if (mode === 'demo') {
  const demoContract = require('./services/contract-demo');

  app.get('/api/profiles', (_req, res) => {
    res.json({
      success: true,
      profiles: demoContract.listProfiles(),
    });
  });

  app.get('/api/attestations', (_req, res) => {
    res.json({
      success: true,
      attestations: demoContract.listAttestations(),
    });
  });
}

// Start server
const port = config.port;
app.listen(port, '0.0.0.0', () => {
  console.log(`TrustBridge backend running on port ${port}`);
  console.log(`Mode: ${mode.toUpperCase()}`);
  console.log(`Network: ${config.network}`);
  if (mode === 'live') {
    console.log(`RPC: ${config.rpcUrl}`);
    console.log(`Package: ${config.packageId}`);
  }
});
