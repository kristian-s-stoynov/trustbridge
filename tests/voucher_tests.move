#[test_only]
module trustbridge::voucher_tests {
    use std::string;
    use iota::test_scenario::{Self as ts};
    use iota::clock::{Self};

    use trustbridge::trust_profile::{Self, TrustProfile};
    use trustbridge::voucher::{Self, Voucher};

    const COMPANY_A: address = @0xA1;
    const COMPANY_B: address = @0xB2;

    #[test]
    fun test_vouch_for_another_company() {
        let mut scenario = ts::begin(COMPANY_A);
        let clock = clock::create_for_testing(scenario.ctx());

        // Create profile A
        trust_profile::create_profile(
            string::utf8(b"Alpha Corp"),
            string::utf8(b"alpha.io"),
            string::utf8(b"did:iota:testnet:0xA"),
            &clock,
            scenario.ctx(),
        );

        scenario.next_tx(COMPANY_A);
        let profile_a = scenario.take_from_sender<TrustProfile>();
        let profile_a_id = object::id(&profile_a);
        scenario.return_to_sender(profile_a);

        // Create profile B
        scenario.next_tx(COMPANY_B);
        trust_profile::create_profile(
            string::utf8(b"Beta Corp"),
            string::utf8(b"beta.io"),
            string::utf8(b"did:iota:testnet:0xB"),
            &clock,
            scenario.ctx(),
        );

        scenario.next_tx(COMPANY_B);
        let profile_b = scenario.take_from_sender<TrustProfile>();
        let profile_b_id = object::id(&profile_b);
        scenario.return_to_sender(profile_b);

        // Company A vouches for Company B
        scenario.next_tx(COMPANY_A);
        voucher::vouch(
            profile_a_id,
            profile_b_id,
            string::utf8(b"Reliable partner, delivered on time"),
            &clock,
            scenario.ctx(),
        );

        // Verify voucher
        scenario.next_tx(COMPANY_A);
        let v = scenario.take_from_sender<Voucher>();

        assert!(voucher::from_profile_id(&v) == profile_a_id);
        assert!(voucher::to_profile_id(&v) == profile_b_id);
        assert!(voucher::from_address(&v) == COMPANY_A);
        assert!(voucher::message(&v) == string::utf8(b"Reliable partner, delivered on time"));

        scenario.return_to_sender(v);
        clock::destroy_for_testing(clock);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = voucher::ECannotVouchSelf)]
    fun test_cannot_vouch_self() {
        let mut scenario = ts::begin(COMPANY_A);
        let clock = clock::create_for_testing(scenario.ctx());

        // Create profile
        trust_profile::create_profile(
            string::utf8(b"Alpha Corp"),
            string::utf8(b"alpha.io"),
            string::utf8(b"did:iota:testnet:0xA"),
            &clock,
            scenario.ctx(),
        );

        scenario.next_tx(COMPANY_A);
        let profile_a = scenario.take_from_sender<TrustProfile>();
        let profile_a_id = object::id(&profile_a);
        scenario.return_to_sender(profile_a);

        // Try to vouch for self — should fail
        scenario.next_tx(COMPANY_A);
        voucher::vouch(
            profile_a_id,
            profile_a_id,
            string::utf8(b"I vouch for myself"),
            &clock,
            scenario.ctx(),
        );

        clock::destroy_for_testing(clock);
        scenario.end();
    }
}
