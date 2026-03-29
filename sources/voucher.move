module trustbridge::voucher {
    use std::string::String;
    use iota::event;
    use iota::clock::Clock;

    // ======== Error codes ========
    const ECannotVouchSelf: u64 = 300;

    // ======== Core object ========

    /// A voucher from one company for another.
    /// Represents peer trust — the 4th star concept.
    public struct Voucher has key, store {
        id: UID,
        /// Object ID of the vouching company's profile
        from_profile_id: ID,
        /// Object ID of the vouched company's profile
        to_profile_id: ID,
        /// Address of the vouching company
        from_address: address,
        /// Free-text endorsement message
        message: String,
        /// Epoch timestamp in ms
        created_at: u64,
    }

    // ======== Events ========

    public struct VouchCreated has copy, drop {
        voucher_id: ID,
        from_profile_id: ID,
        to_profile_id: ID,
        from_address: address,
    }

    // ======== Public entry functions ========

    /// A company vouches for another company.
    /// The voucher is transferred to the vouched company's owner (or stored publicly).
    public entry fun vouch(
        from_profile_id: ID,
        to_profile_id: ID,
        message: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Cannot vouch for yourself
        assert!(from_profile_id != to_profile_id, ECannotVouchSelf);

        let voucher = Voucher {
            id: object::new(ctx),
            from_profile_id,
            to_profile_id,
            from_address: ctx.sender(),
            message,
            created_at: clock.timestamp_ms(),
        };

        event::emit(VouchCreated {
            voucher_id: object::id(&voucher),
            from_profile_id: voucher.from_profile_id,
            to_profile_id: voucher.to_profile_id,
            from_address: voucher.from_address,
        });

        // Transfer to the sender (they hold the voucher as proof)
        transfer::transfer(voucher, ctx.sender());
    }

    // ======== View functions ========

    public fun from_profile_id(v: &Voucher): ID { v.from_profile_id }
    public fun to_profile_id(v: &Voucher): ID { v.to_profile_id }
    public fun from_address(v: &Voucher): address { v.from_address }
    public fun message(v: &Voucher): String { v.message }
    public fun created_at(v: &Voucher): u64 { v.created_at }
}
