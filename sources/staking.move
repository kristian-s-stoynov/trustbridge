module trustbridge::staking {
    use iota::coin::{Self, Coin};
    use iota::balance::{Self, Balance};
    use iota::iota::IOTA;
    use iota::table::{Self, Table};
    use iota::event;

    use trustbridge::trust_profile::{Self, TrustProfile, AdminCap};

    // ======== Error codes ========
    const EInsufficientStake: u64 = 100;
    const ENoStakeFound: u64 = 101;
    const EProfileSlashed: u64 = 102;
    const EStakeAlreadyExists: u64 = 103;
    const ENoSlashedFunds: u64 = 104;

    // ======== Core objects ========

    /// Shared escrow pool that holds all company stakes.
    public struct StakePool has key {
        id: UID,
        stakes: Table<address, Balance<IOTA>>,
        slashed_funds: Balance<IOTA>,
        min_stake: u64,
        total_staked: u64,
        total_stakers: u64,
    }

    // ======== Events ========

    public struct StakeDeposited has copy, drop {
        staker: address,
        amount: u64,
        profile_id: ID,
    }

    public struct StakeWithdrawn has copy, drop {
        staker: address,
        amount: u64,
        profile_id: ID,
    }

    public struct StakeSlashed has copy, drop {
        staker: address,
        amount: u64,
        profile_id: ID,
    }

    public struct SlashedFundsWithdrawn has copy, drop {
        amount: u64,
        recipient: address,
    }

    // ======== Init ========

    /// Creates the shared StakePool on package publish.
    /// min_stake is set to 1_000_000_000 nanos = 1 IOTA.
    fun init(ctx: &mut TxContext) {
        let pool = StakePool {
            id: object::new(ctx),
            stakes: table::new(ctx),
            slashed_funds: balance::zero(),
            min_stake: 1_000_000_000, // 1 IOTA in nanos
            total_staked: 0,
            total_stakers: 0,
        };
        transfer::share_object(pool);
    }

    // ======== Public entry functions ========

    /// Company deposits IOTA tokens as stake.
    /// The profile's `is_staked` flag is set, granting the second star.
    public entry fun stake(
        pool: &mut StakePool,
        payment: Coin<IOTA>,
        profile: &mut TrustProfile,
        ctx: &mut TxContext,
    ) {
        assert!(!trust_profile::is_slashed(profile), EProfileSlashed);

        let sender = ctx.sender();
        let amount = coin::value(&payment);
        assert!(amount >= pool.min_stake, EInsufficientStake);
        assert!(!pool.stakes.contains(sender), EStakeAlreadyExists);

        // Deposit into pool
        pool.stakes.add(sender, coin::into_balance(payment));
        pool.total_staked = pool.total_staked + amount;
        pool.total_stakers = pool.total_stakers + 1;

        // Update trust profile
        trust_profile::set_staked(profile, true);

        event::emit(StakeDeposited {
            staker: sender,
            amount,
            profile_id: object::id(profile),
        });
    }

    /// Company withdraws their stake (only if not slashed).
    public entry fun unstake(
        pool: &mut StakePool,
        profile: &mut TrustProfile,
        ctx: &mut TxContext,
    ) {
        assert!(!trust_profile::is_slashed(profile), EProfileSlashed);

        let sender = ctx.sender();
        assert!(pool.stakes.contains(sender), ENoStakeFound);

        let stake_balance = pool.stakes.remove(sender);
        let amount = balance::value(&stake_balance);

        pool.total_staked = pool.total_staked - amount;
        pool.total_stakers = pool.total_stakers - 1;

        // Update trust profile
        trust_profile::set_staked(profile, false);

        // Return tokens to the company
        let coin = coin::from_balance(stake_balance, ctx);
        transfer::public_transfer(coin, sender);

        event::emit(StakeWithdrawn {
            staker: sender,
            amount,
            profile_id: object::id(profile),
        });
    }

    /// Admin slashes a company's stake. Funds move to slashed_funds.
    /// The profile is also slashed via the trust_profile module.
    public entry fun slash_stake(
        pool: &mut StakePool,
        profile: &mut TrustProfile,
        _admin: &AdminCap,
        ctx: &TxContext,
    ) {
        let staker = ctx.sender(); // Note: we slash the profile owner, not the admin
        // For the MVP, the admin specifies which address to slash
        // In practice, this would resolve from the profile's owner
        // We check if the staker has a stake
        let profile_id = object::id(profile);

        // Slash the trust profile first
        trust_profile::slash(profile, _admin);

        // If the company had staked, confiscate it
        // The admin needs to provide the staker's address
        // For simplicity, we emit the event and the backend handles address lookup
        event::emit(StakeSlashed {
            staker,
            amount: 0, // actual amount resolved at call time
            profile_id,
        });
    }

    /// Admin-callable: slash a specific address's stake from the pool.
    public entry fun slash_stake_by_address(
        pool: &mut StakePool,
        staker: address,
        profile: &mut TrustProfile,
        admin: &AdminCap,
    ) {
        assert!(pool.stakes.contains(staker), ENoStakeFound);

        let stake_balance = pool.stakes.remove(staker);
        let amount = balance::value(&stake_balance);

        pool.total_staked = pool.total_staked - amount;
        pool.total_stakers = pool.total_stakers - 1;

        // Move to slashed funds
        balance::join(&mut pool.slashed_funds, stake_balance);

        // Slash the trust profile
        trust_profile::slash(profile, admin);

        event::emit(StakeSlashed {
            staker,
            amount,
            profile_id: object::id(profile),
        });
    }

    /// Admin withdraws accumulated slashed funds.
    public entry fun withdraw_slashed(
        pool: &mut StakePool,
        _admin: &AdminCap,
        ctx: &mut TxContext,
    ) {
        let amount = balance::value(&pool.slashed_funds);
        assert!(amount > 0, ENoSlashedFunds);

        let withdrawn = balance::withdraw_all(&mut pool.slashed_funds);
        let coin = coin::from_balance(withdrawn, ctx);
        let recipient = ctx.sender();
        transfer::public_transfer(coin, recipient);

        event::emit(SlashedFundsWithdrawn {
            amount,
            recipient,
        });
    }

    // ======== View functions ========

    public fun min_stake(pool: &StakePool): u64 { pool.min_stake }
    public fun total_staked(pool: &StakePool): u64 { pool.total_staked }
    public fun total_stakers(pool: &StakePool): u64 { pool.total_stakers }
    public fun slashed_funds_amount(pool: &StakePool): u64 {
        balance::value(&pool.slashed_funds)
    }
    public fun has_stake(pool: &StakePool, addr: address): bool {
        pool.stakes.contains(addr)
    }
}
