module trustbridge::attestation_registry {
    use std::string::String;
    use iota::event;
    use iota::clock::Clock;

    use trustbridge::trust_profile::AdminCap;

    // ======== Error codes ========
    const EAlreadyRevoked: u64 = 200;

    // ======== Core object ========

    /// On-chain record linking to an off-chain Verifiable Credential.
    /// Created by the backend after an attester issues a VC via IOTA Identity.
    public struct AttestationRecord has key, store {
        id: UID,
        /// Object ID of the company's TrustProfile
        company_profile_id: ID,
        /// DID of the attester who issued the credential
        attester_did: String,
        /// SHA-256 hash of the VC JWT (integrity anchor)
        credential_hash: vector<u8>,
        /// Type of credential, e.g. "BusinessRegistration", "IncorporationCertificate"
        credential_type: String,
        /// Epoch timestamp in ms
        issued_at: u64,
        /// Whether this attestation has been revoked
        revoked: bool,
        /// Optional: epoch timestamp of revocation
        revoked_at: u64,
    }

    // ======== Events ========

    public struct AttestationRegistered has copy, drop {
        record_id: ID,
        company_profile_id: ID,
        attester_did: String,
        credential_type: String,
    }

    public struct AttestationRevoked has copy, drop {
        record_id: ID,
        company_profile_id: ID,
        attester_did: String,
    }

    // ======== Public entry functions ========

    /// Register a new attestation record on-chain.
    /// Called by the backend after the attester issues a VC.
    public entry fun register_attestation(
        company_profile_id: ID,
        attester_did: String,
        credential_hash: vector<u8>,
        credential_type: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let record = AttestationRecord {
            id: object::new(ctx),
            company_profile_id,
            attester_did,
            credential_hash,
            credential_type,
            issued_at: clock.timestamp_ms(),
            revoked: false,
            revoked_at: 0,
        };

        event::emit(AttestationRegistered {
            record_id: object::id(&record),
            company_profile_id: record.company_profile_id,
            attester_did: record.attester_did,
            credential_type: record.credential_type,
        });

        // Transfer to the caller (attester or admin)
        transfer::transfer(record, ctx.sender());
    }

    /// Revoke an attestation. Only the admin (or attester with admin consent) can revoke.
    public entry fun revoke_attestation(
        record: &mut AttestationRecord,
        _admin: &AdminCap,
        clock: &Clock,
    ) {
        assert!(!record.revoked, EAlreadyRevoked);

        record.revoked = true;
        record.revoked_at = clock.timestamp_ms();

        event::emit(AttestationRevoked {
            record_id: object::id(record),
            company_profile_id: record.company_profile_id,
            attester_did: record.attester_did,
        });
    }

    // ======== View functions ========

    public fun is_valid(record: &AttestationRecord): bool { !record.revoked }
    public fun company_profile_id(record: &AttestationRecord): ID { record.company_profile_id }
    public fun attester_did(record: &AttestationRecord): String { record.attester_did }
    public fun credential_hash(record: &AttestationRecord): vector<u8> { record.credential_hash }
    public fun credential_type(record: &AttestationRecord): String { record.credential_type }
    public fun issued_at(record: &AttestationRecord): u64 { record.issued_at }
    public fun revoked_at(record: &AttestationRecord): u64 { record.revoked_at }
}
