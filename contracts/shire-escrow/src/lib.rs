#![no_std]

use soroban_sdk::contract;

/// Future stablecoin escrow contract for Shire on Stellar (Soroban).
/// See `.agent/context/onchain/contract-design.md` for the intended
/// entrypoints, storage shape, and events.
#[contract]
pub struct ShireEscrow;
