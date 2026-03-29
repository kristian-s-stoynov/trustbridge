// ======== Request/Response types for the API ========

export interface CreateProfileRequest {
  companyName: string;
  domain: string;
  did: string;
}

export interface StakeRequest {
  profileId: string;
  amount: number; // in IOTA (will be converted to nanos)
}

export interface UnstakeRequest {
  profileId: string;
}

export interface SlashRequest {
  profileId: string;
  stakerAddress: string;
}

export interface RegisterAttestationRequest {
  companyProfileId: string;
  attesterDid: string;
  credentialHash: string; // hex-encoded SHA-256
  credentialType: string;
}

export interface RevokeAttestationRequest {
  attestationRecordId: string;
}

export interface VouchRequest {
  fromProfileId: string;
  toProfileId: string;
  message: string;
}

export interface RecordDealRequest {
  profileId: string;
}

// ======== On-chain object shapes (as returned by queries) ========

export interface TrustProfileData {
  id: string;
  companyName: string;
  domain: string;
  did: string;
  trustStars: number;
  isVerified: boolean;
  isStaked: boolean;
  isProven: boolean;
  isVouched: boolean;
  completedDeals: number;
  createdAt: number;
  isSlashed: boolean;
}

export interface AttestationRecordData {
  id: string;
  companyProfileId: string;
  attesterDid: string;
  credentialHash: string;
  credentialType: string;
  issuedAt: number;
  revoked: boolean;
  revokedAt: number;
}

export interface StakePoolData {
  id: string;
  minStake: number;
  totalStaked: number;
  totalStakers: number;
  slashedFundsAmount: number;
}

export interface VoucherData {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  fromAddress: string;
  message: string;
  createdAt: number;
}
