#[test_only]
module trustbridge::trust_profile_tests {
    use std::string;
    use iota::test_scenario::{Self as ts};
    use iota::clock::{Self};

    use trustbridge::trust_profile::{Self, TrustProfile, AdminCap};

    const ADMIN: address = @0xAD;
    const COMPANY: address = @0xC0;

    #[test]
    fun test_create_profile() {
        let mut scenario = ts::begin(COMPANY);
        let clock = clock::create_for_testing(scenario.ctx());

        // Create profile
        trust_profile::create_profile(
            string::utf8(b"Acme Corp"),
            string::utf8(b"acme.com"),
            string::utf8(b"did:iota:testnet:0x1234"),
            &clock,
            scenario.ctx(),
        );

        // Verify profile was created
        scenario.next_tx(COMPANY);
        let profile = scenario.take_from_sender<TrustProfile>();

        assert!(trust_profile::company_name(&profile) == string::utf8(b"Acme Corp"));
        assert!(trust_profile::domain(&profile) == string::utf8(b"acme.com"));
        assert!(trust_profile::did(&profile) == string::utf8(b"did:iota:testnet:0x1234"));
        assert!(trust_profile::trust_stars(&profile) == 0);
        assert!(!trust_profile::is_verified(&profile));
        assert!(!trust_profile::is_staked(&profile));
        assert!(!trust_profile::is_proven(&profile));
        assert!(!trust_profile::is_vouched(&profile));
        assert!(!trust_profile::is_slashed(&profile));
        assert!(trust_profile::completed_deals(&profile) == 0);

        scenario.return_to_sender(profile);
        clock::destroy_for_testing(clock);
        scenario.end();
    }

    #[test]
    fun test_mark_verified() {
        let mut scenario = ts::begin(ADMIN);

        // Create admin cap
        let admin_cap = trust_profile::create_admin_cap_for_testing(scenario.ctx());
        let clock = clock::create_for_testing(scenario.ctx());

        // Create profile as company
        scenario.next_tx(COMPANY);
        trust_profile::create_profile(
            string::utf8(b"Acme Corp"),
            string::utf8(b"acme.com"),
            string::utf8(b"did:iota:testnet:0x1234"),
            &clock,
            scenario.ctx(),
        );

        // Mark as verified
        scenario.next_tx(COMPANY);
        let mut profile = scenario.take_from_sender<TrustProfile>();
        trust_profile::mark_verified(&mut profile, &admin_cap);

        assert!(trust_profile::is_verified(&profile));
        assert!(trust_profile::trust_stars(&profile) == 1);

        scenario.return_to_sender(profile);
        transfer::public_transfer(admin_cap, ADMIN);
        clock::destroy_for_testing(clock);
        scenario.end();
    }

    #[test]
    fun test_record_deal_and_auto_proven() {
        let mut scenario = ts::begin(ADMIN);

        let admin_cap = trust_profile::create_admin_cap_for_testing(scenario.ctx());
        let clock = clock::create_for_testing(scenario.ctx());

        // Create profile
        scenario.next_tx(COMPANY);
        trust_profile::create_profile(
            string::utf8(b"Acme Corp"),
            string::utf8(b"acme.com"),
            string::utf8(b"did:iota:testnet:0x1234"),
            &clock,
            scenario.ctx(),
        );

        // Record 3 deals → should auto-promote to proven
        scenario.next_tx(COMPANY);
        let mut profile = scenario.take_from_sender<TrustProfile>();

        trust_profile::record_deal(&mut profile, &admin_cap);
        assert!(trust_profile::completed_deals(&profile) == 1);
        assert!(!trust_profile::is_proven(&profile));

        trust_profile::record_deal(&mut profile, &admin_cap);
        assert!(trust_profile::completed_deals(&profile) == 2);
        assert!(!trust_profile::is_proven(&profile));

        trust_profile::record_deal(&mut profile, &admin_cap);
        assert!(trust_profile::completed_deals(&profile) == 3);
        assert!(trust_profile::is_proven(&profile));
        assert!(trust_profile::trust_stars(&profile) == 1); // only proven star

        scenario.return_to_sender(profile);
        transfer::public_transfer(admin_cap, ADMIN);
        clock::destroy_for_testing(clock);
        scenario.end();
    }

    #[test]
    fun test_slash_resets_all() {
        let mut scenario = ts::begin(ADMIN);

        let admin_cap = trust_profile::create_admin_cap_for_testing(scenario.ctx());
        let clock = clock::create_for_testing(scenario.ctx());

        // Create and verify profile
        scenario.next_tx(COMPANY);
        trust_profile::create_profile(
            string::utf8(b"Bad Corp"),
            string::utf8(b"bad.com"),
            string::utf8(b"did:iota:testnet:0xBAD"),
            &clock,
            scenario.ctx(),
        );

        scenario.next_tx(COMPANY);
        let mut profile = scenario.take_from_sender<TrustProfile>();
        trust_profile::mark_verified(&mut profile, &admin_cap);
        assert!(trust_profile::trust_stars(&profile) == 1);

        // Slash
        trust_profile::slash(&mut profile, &admin_cap);
        assert!(trust_profile::is_slashed(&profile));
        assert!(trust_profile::trust_stars(&profile) == 0);
        assert!(!trust_profile::is_verified(&profile));

        scenario.return_to_sender(profile);
        transfer::public_transfer(admin_cap, ADMIN);
        clock::destroy_for_testing(clock);
        scenario.end();
    }

    #[test]
    fun test_full_star_progression() {
        let mut scenario = ts::begin(ADMIN);

        let admin_cap = trust_profile::create_admin_cap_for_testing(scenario.ctx());
        let clock = clock::create_for_testing(scenario.ctx());

        scenario.next_tx(COMPANY);
        trust_profile::create_profile(
            string::utf8(b"Star Corp"),
            string::utf8(b"star.io"),
            string::utf8(b"did:iota:testnet:0xSTAR"),
            &clock,
            scenario.ctx(),
        );

        scenario.next_tx(COMPANY);
        let mut profile = scenario.take_from_sender<TrustProfile>();

        // ★ Verified
        trust_profile::mark_verified(&mut profile, &admin_cap);
        assert!(trust_profile::trust_stars(&profile) == 1);

        // ★★ Staked (simulated via package-internal call)
        trust_profile::set_staked(&mut profile, true);
        assert!(trust_profile::trust_stars(&profile) == 2);

        // ★★★ Proven (3 deals)
        trust_profile::record_deal(&mut profile, &admin_cap);
        trust_profile::record_deal(&mut profile, &admin_cap);
        trust_profile::record_deal(&mut profile, &admin_cap);
        assert!(trust_profile::trust_stars(&profile) == 3);

        // ★★★★ Vouched
        trust_profile::mark_vouched(&mut profile, &admin_cap);
        assert!(trust_profile::trust_stars(&profile) == 4);

        scenario.return_to_sender(profile);
        transfer::public_transfer(admin_cap, ADMIN);
        clock::destroy_for_testing(clock);
        scenario.end();
    }
}
