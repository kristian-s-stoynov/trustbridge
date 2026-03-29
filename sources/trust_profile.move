module trustbridge::trust_profile {
    use std::string::String;
    use iota::event;
    use iota::clock::Clock;

    // ======== Error codes ========
    const EAlreadyVerified: u64 = 0;
    const EAlreadyStaked: u64 = 1;
    const EAlreadyProven: u64 = 2;
    const EAlreadyVouched: u64 = 3;
    const EAlreadySlashed: u64 = 4;
    const ENotEnoughDeals: u64 = 5;
    const EProfileSlashed: u64 = 6;

    /// Minimum deals required to earn the "Proven" star
    const PROVEN_DEAL_THRESHOLD: u64 = 3;

    // ======== Capability ========

    /// Admin capability — holder can update trust states and slash profiles.
    /// Created once on package publish and transferred to the publisher.
    public struct AdminCap has key, store {
        id: UID,
    }

    // ======== Core object ========

    /// On-chain trust profile for a company.
    public struct TrustProfile has key, store {
        id: UID,
        company_name: String,
        domain: String,
        did: String,
        trust_stars: u8,
        is_verified: bool,
        is_staked: bool,
        is_proven: bool,
        is_vouched: bool,
        completed_deals: u64,
        created_at: u64,
        is_slashed: bool,
    }

    // ======== Events ========

    public struct ProfileCreated has copy, drop {
        profile_id: ID,
        company_name: String,
        did: String,
    }

    public struct ProfileVerified has copy, drop {
        profile_id: ID,
    }

    public struct ProfileProven has copy, drop {
        profile_id: ID,
        total_deals: u64,
    }

    public struct ProfileVouched has copy, drop {
        profile_id: ID,
    }

    public struct DealRecorded has copy, drop {
        profile_id: ID,
        total_deals: u64,
    }

    public struct ProfileSlashed has copy, drop {
        profile_id: ID,
    }

    // ======== Init ========

    /// Called once on package publish. Creates the AdminCap.
    fun init(ctx: &mut TxContext) {
        transfer::transfer(
            AdminCap { id: object::new(ctx) },
            ctx.sender(),
        );
    }

    // ======== Public entry functions ========

    /// Any company can create its own trust profile.
    public entry fun create_profile(
        company_name: String,
        domain: String,
        did: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let profile = TrustProfile {
            id: object::new(ctx),
            company_name,
            domain,
            did,
            trust_stars: 0,
            is_verified: false,
            is_staked: false,
            is_proven: false,
            is_vouched: false,
            completed_deals: 0,
            created_at: clock.timestamp_ms(),
            is_slashed: false,
        };

        event::emit(ProfileCreated {
            profile_id: object::id(&profile),
            company_name: profile.company_name,
            did: profile.did,
        });

        transfer::transfer(profile, ctx.sender());
    }

    /// Admin marks a profile as verified (★ first star).
    /// Called after an attester has issued a verifiable credential.
    public entry fun mark_verified(
        profile: &mut TrustProfile,
        _admin: &AdminCap,
    ) {
        assert!(!profile.is_slashed, EProfileSlashed);
        assert!(!profile.is_verified, EAlreadyVerified);

        profile.is_verified = true;
        recalculate_stars(profile);

        event::emit(ProfileVerified {
            profile_id: object::id(profile),
        });
    }

    /// Record a completed deal for a company.
    /// If the deal count crosses the threshold, automatically marks as proven.
    public entry fun record_deal(
        profile: &mut TrustProfile,
        _admin: &AdminCap,
    ) {
        assert!(!profile.is_slashed, EProfileSlashed);

        profile.completed_deals = profile.completed_deals + 1;

        event::emit(DealRecorded {
            profile_id: object::id(profile),
            total_deals: profile.completed_deals,
        });

        // Auto-promote to proven if threshold met
        if (!profile.is_proven && profile.completed_deals >= PROVEN_DEAL_THRESHOLD) {
            profile.is_proven = true;
            recalculate_stars(profile);

            event::emit(ProfileProven {
                profile_id: object::id(profile),
                total_deals: profile.completed_deals,
            });
        };
    }

    /// Admin marks a profile as vouched (★★★★ fourth star).
    public entry fun mark_vouched(
        profile: &mut TrustProfile,
        _admin: &AdminCap,
    ) {
        assert!(!profile.is_slashed, EProfileSlashed);
        assert!(!profile.is_vouched, EAlreadyVouched);

        profile.is_vouched = true;
        recalculate_stars(profile);

        event::emit(ProfileVouched {
            profile_id: object::id(profile),
        });
    }

    /// Slash a fraudulent company. Resets all trust stars.
    public entry fun slash(
        profile: &mut TrustProfile,
        _admin: &AdminCap,
    ) {
        assert!(!profile.is_slashed, EAlreadySlashed);

        profile.is_slashed = true;
        profile.trust_stars = 0;
        profile.is_verified = false;
        profile.is_staked = false;
        profile.is_proven = false;
        profile.is_vouched = false;

        event::emit(ProfileSlashed {
            profile_id: object::id(profile),
        });
    }

    // ======== Friend-only (called by staking module) ========

    /// Set the staked flag. Called by the staking module when a company stakes.
    public(package) fun set_staked(profile: &mut TrustProfile, staked: bool) {
        profile.is_staked = staked;
        recalculate_stars(profile);
    }

    // ======== View functions ========

    public fun trust_stars(profile: &TrustProfile): u8 { profile.trust_stars }
    public fun is_verified(profile: &TrustProfile): bool { profile.is_verified }
    public fun is_staked(profile: &TrustProfile): bool { profile.is_staked }
    public fun is_proven(profile: &TrustProfile): bool { profile.is_proven }
    public fun is_vouched(profile: &TrustProfile): bool { profile.is_vouched }
    public fun is_slashed(profile: &TrustProfile): bool { profile.is_slashed }
    public fun completed_deals(profile: &TrustProfile): u64 { profile.completed_deals }
    public fun company_name(profile: &TrustProfile): String { profile.company_name }
    public fun domain(profile: &TrustProfile): String { profile.domain }
    public fun did(profile: &TrustProfile): String { profile.did }

    // ======== Internal ========

    /// Recalculates the star count from the four boolean flags.
    fun recalculate_stars(profile: &mut TrustProfile) {
        let mut stars: u8 = 0;
        if (profile.is_verified) stars = stars + 1;
        if (profile.is_staked) stars = stars + 1;
        if (profile.is_proven) stars = stars + 1;
        if (profile.is_vouched) stars = stars + 1;
        profile.trust_stars = stars;
    }

    // ======== Tests ========

    #[test_only]
    public fun create_admin_cap_for_testing(ctx: &mut TxContext): AdminCap {
        AdminCap { id: object::new(ctx) }
    }
}
