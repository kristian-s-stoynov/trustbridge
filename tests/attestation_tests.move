#[test_only]
module trustbridge::attestation_tests {
    use std::string;
    use iota::test_scenario::{Self as ts};
    use iota::clock::{Self};

    use trustbridge::trust_profile::{Self, TrustProfile};
    use trustbridge::attestation_registry::{Self, AttestationRecord};

    const ADMIN: address = @0xAD;
    const ATTESTER: address = @0xAA;
    const COMPANY: address = @0xC0;

    #[test]
    fun test_register_and_verify_attestation() {
        let mut scenario = ts::begin(COMPANY);
        let clock = clock::create_for_testing(scenario.ctx());

        // Create a company profile to get its ID
        trust_profile::create_profile(
            string::utf8(b"Acme Corp"),
            string::utf8(b"acme.com"),
            string::utf8(b"did:iota:testnet:0x1234"),
            &clock,
            scenario.ctx(),
        );

        scenario.next_tx(COMPANY);
        let profile = scenario.take_from_sender<TrustProfile>();
        let profile_id = object::id(&profile);
        scenario.return_to_sender(profile);

        // Attester registers an attestation
        scenario.next_tx(ATTESTER);
        attestation_registry::register_attestation(
            profile_id,
            string::utf8(b"did:iota:testnet:0xATTESTER"),
            b"sha256_hash_of_vc_jwt_here_1234567890",
            string::utf8(b"BusinessRegistration"),
            &clock,
            scenario.ctx(),
        );

        // Verify the attestation record
        scenario.next_tx(ATTESTER);
        let record = scenario.take_from_sender<AttestationRecord>();

        assert!(attestation_registry::is_valid(&record));
        assert!(attestation_registry::company_profile_id(&record) == profile_id);
        assert!(attestation_registry::attester_did(&record) == string::utf8(b"did:iota:testnet:0xATTESTER"));
        assert!(attestation_registry::credential_type(&record) == string::utf8(b"BusinessRegistration"));

        scenario.return_to_sender(record);
        clock::destroy_for_testing(clock);
        scenario.end();
    }

    #[test]
    fun test_revoke_attestation() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(scenario.ctx());
        let admin_cap = trust_profile::create_admin_cap_for_testing(scenario.ctx());

        // Create profile
        scenario.next_tx(COMPANY);
        trust_profile::create_profile(
            string::utf8(b"Bad Corp"),
            string::utf8(b"bad.com"),
            string::utf8(b"did:iota:testnet:0xBAD"),
            &clock,
            scenario.ctx(),
        );

        scenario.next_tx(COMPANY);
        let profile = scenario.take_from_sender<TrustProfile>();
        let profile_id = object::id(&profile);
        scenario.return_to_sender(profile);

        // Register attestation
        scenario.next_tx(ATTESTER);
        attestation_registry::register_attestation(
            profile_id,
            string::utf8(b"did:iota:testnet:0xATTESTER"),
            b"sha256_hash_here",
            string::utf8(b"BusinessRegistration"),
            &clock,
            scenario.ctx(),
        );

        // Revoke it
        scenario.next_tx(ATTESTER);
        let mut record = scenario.take_from_sender<AttestationRecord>();
        assert!(attestation_registry::is_valid(&record));

        attestation_registry::revoke_attestation(&mut record, &admin_cap, &clock);
        assert!(!attestation_registry::is_valid(&record));
        assert!(attestation_registry::revoked_at(&record) > 0);

        scenario.return_to_sender(record);
        transfer::public_transfer(admin_cap, ADMIN);
        clock::destroy_for_testing(clock);
        scenario.end();
    }
}
