#![no_std]

//! ShireEscrow — stablecoin escrow for the Shire hiring marketplace.
//!
//! Both sides (applicant and company) stake a stablecoin (a Stellar Asset
//! Contract, e.g. USDC) into this contract. Stakes are released back once
//! both sides confirm the engagement is complete, refunded to the applicant
//! if no company accepts before the deadline, or split by a trusted
//! resolver if a dispute is opened. See
//! `.agent/context/onchain/contract-design.md` for the full design.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    Env, String,
};

/// Bump persistent (per-application) storage roughly every ~30 days,
/// extending it out to ~60 days, so long-lived applications don't expire.
const APPLICATION_TTL_THRESHOLD: u32 = 17280 * 30;
const APPLICATION_TTL_EXTEND_TO: u32 = 17280 * 60;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ApplicationStatus {
    Pending,
    ApplicantStaked,
    CompanyStaked,
    Completed,
    Expired,
    Disputed,
    Resolved,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Application {
    pub id: u64,
    pub job_id: u64,
    pub applicant: Address,
    // No company is known until `company_accept_and_stake` — Soroban's
    // `Address` has no null value, so this stays `None` until accepted
    // (unlike the non-optional field sketched in the design doc).
    pub company: Option<Address>,
    pub token: Address,
    pub applicant_stake: i128,
    pub company_stake: i128,
    pub status: ApplicationStatus,
    pub created_at: u64,
    pub deadline: u64,
    pub dispute_opened: bool,
    // Tracks the company's "work is done" attestation so a single call
    // can't unilaterally release funds — `confirm_completed` also requires
    // this to be true before the applicant can release the escrow.
    pub company_marked_completed: bool,
}

#[contracttype]
pub enum DataKey {
    Application(u64),
    Counter,
    Resolver,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    ApplicationNotFound = 3,
    InvalidStatus = 4,
    Unauthorized = 5,
    DeadlinePassed = 6,
    DeadlineNotReached = 7,
    InvalidAmount = 8,
    DisputeAlreadyOpened = 9,
    InvalidPayoutSum = 10,
    NotDisputeParty = 11,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApplicationCreated {
    #[topic]
    pub application_id: u64,
    pub job_id: u64,
    pub applicant: Address,
    pub applicant_stake: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompanyStakedEvent {
    #[topic]
    pub application_id: u64,
    pub company: Address,
    pub company_stake: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompanyMarkedCompleted {
    #[topic]
    pub application_id: u64,
    pub company: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApplicationCompleted {
    #[topic]
    pub application_id: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakeReleased {
    #[topic]
    pub application_id: u64,
    pub applicant_payout: i128,
    pub company_payout: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApplicationExpired {
    #[topic]
    pub application_id: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeOpened {
    #[topic]
    pub application_id: u64,
    pub opened_by: Address,
    pub evidence_uri: String,
    pub evidence_hash: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeResolved {
    #[topic]
    pub application_id: u64,
    pub applicant_payout: i128,
    pub company_payout: i128,
}

fn read_application(env: &Env, id: u64) -> Result<Application, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Application(id))
        .ok_or(Error::ApplicationNotFound)
}

fn write_application(env: &Env, app: &Application) {
    let key = DataKey::Application(app.id);
    env.storage().persistent().set(&key, app);
    env.storage()
        .persistent()
        .extend_ttl(&key, APPLICATION_TTL_THRESHOLD, APPLICATION_TTL_EXTEND_TO);
}

#[contract]
pub struct ShireEscrow;

#[contractimpl]
impl ShireEscrow {
    /// One-time setup: records the resolver address allowed to call
    /// `resolve_dispute`. Must be called once before any other entrypoint.
    pub fn initialize(env: Env, resolver: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Resolver) {
            return Err(Error::AlreadyInitialized);
        }
        resolver.require_auth();
        env.storage().instance().set(&DataKey::Resolver, &resolver);
        env.storage().instance().set(&DataKey::Counter, &0u64);
        Ok(())
    }

    /// Applicant creates an application and stakes `applicant_stake` of
    /// `token` into escrow. Returns the new application id.
    pub fn create_application(
        env: Env,
        applicant: Address,
        job_id: u64,
        token: Address,
        applicant_stake: i128,
        deadline: u64,
    ) -> Result<u64, Error> {
        applicant.require_auth();
        if applicant_stake <= 0 {
            return Err(Error::InvalidAmount);
        }
        if deadline <= env.ledger().timestamp() {
            return Err(Error::DeadlinePassed);
        }

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&applicant, env.current_contract_address(), &applicant_stake);

        let counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::Counter)
            .unwrap_or(0);
        let id = counter + 1;
        env.storage().instance().set(&DataKey::Counter, &id);

        let application = Application {
            id,
            job_id,
            applicant: applicant.clone(),
            company: None,
            token,
            applicant_stake,
            company_stake: 0,
            status: ApplicationStatus::ApplicantStaked,
            created_at: env.ledger().timestamp(),
            deadline,
            dispute_opened: false,
            company_marked_completed: false,
        };
        write_application(&env, &application);

        ApplicationCreated {
            application_id: id,
            job_id,
            applicant,
            applicant_stake,
        }
        .publish(&env);

        Ok(id)
    }

    /// Company accepts an open application and stakes `company_stake`.
    pub fn company_accept_and_stake(
        env: Env,
        company: Address,
        application_id: u64,
        company_stake: i128,
    ) -> Result<(), Error> {
        company.require_auth();
        let mut app = read_application(&env, application_id)?;
        if app.status != ApplicationStatus::ApplicantStaked {
            return Err(Error::InvalidStatus);
        }
        if env.ledger().timestamp() > app.deadline {
            return Err(Error::DeadlinePassed);
        }
        if company_stake <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token_client = token::Client::new(&env, &app.token);
        token_client.transfer(&company, env.current_contract_address(), &company_stake);

        app.company = Some(company.clone());
        app.company_stake = company_stake;
        app.status = ApplicationStatus::CompanyStaked;
        write_application(&env, &app);

        CompanyStakedEvent {
            application_id,
            company,
            company_stake,
        }
        .publish(&env);

        Ok(())
    }

    /// Company attests the engagement is complete. Does not move funds —
    /// `confirm_completed` (applicant) is still required to release escrow.
    pub fn mark_completed(env: Env, company: Address, application_id: u64) -> Result<(), Error> {
        company.require_auth();
        let mut app = read_application(&env, application_id)?;
        let app_company = app.company.clone().ok_or(Error::InvalidStatus)?;
        if app_company != company {
            return Err(Error::Unauthorized);
        }
        if app.status != ApplicationStatus::CompanyStaked {
            return Err(Error::InvalidStatus);
        }

        app.company_marked_completed = true;
        write_application(&env, &app);

        CompanyMarkedCompleted {
            application_id,
            company,
        }
        .publish(&env);

        Ok(())
    }

    /// Applicant confirms completion (after the company has marked it),
    /// releasing both stakes back to their owners.
    pub fn confirm_completed(env: Env, applicant: Address, application_id: u64) -> Result<(), Error> {
        applicant.require_auth();
        let mut app = read_application(&env, application_id)?;
        if app.applicant != applicant {
            return Err(Error::Unauthorized);
        }
        if app.status != ApplicationStatus::CompanyStaked {
            return Err(Error::InvalidStatus);
        }
        if !app.company_marked_completed {
            return Err(Error::InvalidStatus);
        }
        let company = app.company.clone().ok_or(Error::InvalidStatus)?;

        let token_client = token::Client::new(&env, &app.token);
        token_client.transfer(&env.current_contract_address(), &applicant, &app.applicant_stake);
        token_client.transfer(&env.current_contract_address(), &company, &app.company_stake);

        app.status = ApplicationStatus::Completed;
        write_application(&env, &app);

        ApplicationCompleted { application_id }.publish(&env);
        StakeReleased {
            application_id,
            applicant_payout: app.applicant_stake,
            company_payout: app.company_stake,
        }
        .publish(&env);

        Ok(())
    }

    /// Permissionless cleanup: refunds the applicant if no company accepted
    /// before the deadline. Pays out to the address already on record, so
    /// no caller authorization is required.
    pub fn refund_expired(env: Env, application_id: u64) -> Result<(), Error> {
        let mut app = read_application(&env, application_id)?;
        if app.status != ApplicationStatus::ApplicantStaked {
            return Err(Error::InvalidStatus);
        }
        if env.ledger().timestamp() <= app.deadline {
            return Err(Error::DeadlineNotReached);
        }

        let token_client = token::Client::new(&env, &app.token);
        token_client.transfer(&env.current_contract_address(), &app.applicant, &app.applicant_stake);

        app.status = ApplicationStatus::Expired;
        write_application(&env, &app);

        ApplicationExpired { application_id }.publish(&env);

        Ok(())
    }

    /// Either party opens a dispute once both sides have staked, freezing
    /// the escrow until the resolver calls `resolve_dispute`.
    pub fn open_dispute(
        env: Env,
        caller: Address,
        application_id: u64,
        evidence_uri: String,
        evidence_hash: BytesN<32>,
    ) -> Result<(), Error> {
        caller.require_auth();
        let mut app = read_application(&env, application_id)?;
        let company = app.company.clone().ok_or(Error::InvalidStatus)?;
        if caller != app.applicant && caller != company {
            return Err(Error::NotDisputeParty);
        }
        if app.status != ApplicationStatus::CompanyStaked {
            return Err(Error::InvalidStatus);
        }
        if app.dispute_opened {
            return Err(Error::DisputeAlreadyOpened);
        }

        app.dispute_opened = true;
        app.status = ApplicationStatus::Disputed;
        write_application(&env, &app);

        DisputeOpened {
            application_id,
            opened_by: caller,
            evidence_uri,
            evidence_hash,
        }
        .publish(&env);

        Ok(())
    }

    /// Resolver splits the combined stake between applicant and company.
    /// `applicant_payout + company_payout` must equal the total escrowed.
    pub fn resolve_dispute(
        env: Env,
        resolver: Address,
        application_id: u64,
        applicant_payout: i128,
        company_payout: i128,
    ) -> Result<(), Error> {
        resolver.require_auth();
        let stored_resolver: Address = env
            .storage()
            .instance()
            .get(&DataKey::Resolver)
            .ok_or(Error::NotInitialized)?;
        if resolver != stored_resolver {
            return Err(Error::Unauthorized);
        }

        let mut app = read_application(&env, application_id)?;
        if app.status != ApplicationStatus::Disputed {
            return Err(Error::InvalidStatus);
        }
        if applicant_payout < 0 || company_payout < 0 {
            return Err(Error::InvalidAmount);
        }
        let total = app.applicant_stake + app.company_stake;
        if applicant_payout + company_payout != total {
            return Err(Error::InvalidPayoutSum);
        }
        let company = app.company.clone().ok_or(Error::InvalidStatus)?;

        let token_client = token::Client::new(&env, &app.token);
        if applicant_payout > 0 {
            token_client.transfer(&env.current_contract_address(), &app.applicant, &applicant_payout);
        }
        if company_payout > 0 {
            token_client.transfer(&env.current_contract_address(), &company, &company_payout);
        }

        app.status = ApplicationStatus::Resolved;
        write_application(&env, &app);

        DisputeResolved {
            application_id,
            applicant_payout,
            company_payout,
        }
        .publish(&env);

        Ok(())
    }

    /// Read-only view of an application.
    pub fn get_application(env: Env, application_id: u64) -> Result<Application, Error> {
        read_application(&env, application_id)
    }

    /// Read-only view of the configured resolver address.
    pub fn get_resolver(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Resolver)
            .ok_or(Error::NotInitialized)
    }
}

#[cfg(test)]
mod test;
