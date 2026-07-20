#![cfg(test)]

use super::{ApplicationStatus, Error, ShireEscrow, ShireEscrowClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, BytesN, Env, String,
};

#[allow(dead_code)]
struct Setup<'a> {
    env: Env,
    client: ShireEscrowClient<'a>,
    token: token::Client<'a>,
    token_admin: token::StellarAssetClient<'a>,
    resolver: Address,
    applicant: Address,
    company: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ShireEscrow, ());
    let client = ShireEscrowClient::new(&env, &contract_id);

    let token_admin_address = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin_address.clone());
    let token = token::Client::new(&env, &sac.address());
    let token_admin = token::StellarAssetClient::new(&env, &sac.address());

    let resolver = Address::generate(&env);
    let applicant = Address::generate(&env);
    let company = Address::generate(&env);

    token_admin.mint(&applicant, &1_000_000);
    token_admin.mint(&company, &1_000_000);

    client.initialize(&resolver);

    Setup {
        env,
        client,
        token,
        token_admin,
        resolver,
        applicant,
        company,
    }
}

#[test]
fn full_happy_path_releases_both_stakes() {
    let s = setup();
    let deadline = s.env.ledger().timestamp() + 1000;

    let id = s.client.create_application(
        &s.applicant,
        &1,
        &s.token.address,
        &100,
        &deadline,
    );
    assert_eq!(s.token.balance(&s.applicant), 1_000_000 - 100);
    assert_eq!(s.token.balance(&s.client.address), 100);

    s.client
        .company_accept_and_stake(&s.company, &id, &200);
    assert_eq!(s.token.balance(&s.company), 1_000_000 - 200);
    assert_eq!(s.token.balance(&s.client.address), 300);

    let app = s.client.get_application(&id);
    assert_eq!(app.status, ApplicationStatus::CompanyStaked);
    assert_eq!(app.company, Some(s.company.clone()));

    s.client.mark_completed(&s.company, &id);
    let app = s.client.get_application(&id);
    assert!(app.company_marked_completed);

    s.client.confirm_completed(&s.applicant, &id);

    assert_eq!(s.token.balance(&s.applicant), 1_000_000);
    assert_eq!(s.token.balance(&s.company), 1_000_000);
    assert_eq!(s.token.balance(&s.client.address), 0);

    let app = s.client.get_application(&id);
    assert_eq!(app.status, ApplicationStatus::Completed);
}

#[test]
fn confirm_completed_before_company_marks_fails() {
    let s = setup();
    let deadline = s.env.ledger().timestamp() + 1000;
    let id = s
        .client
        .create_application(&s.applicant, &1, &s.token.address, &100, &deadline);
    s.client.company_accept_and_stake(&s.company, &id, &200);

    let result = s
        .client
        .try_confirm_completed(&s.applicant, &id);
    assert_eq!(result, Err(Ok(Error::InvalidStatus)));
}

#[test]
fn refund_expired_returns_applicant_stake_when_uncontested() {
    let s = setup();
    let deadline = s.env.ledger().timestamp() + 1000;
    let id = s
        .client
        .create_application(&s.applicant, &1, &s.token.address, &100, &deadline);

    s.env.ledger().with_mut(|li| li.timestamp = deadline + 1);

    s.client.refund_expired(&id);

    assert_eq!(s.token.balance(&s.applicant), 1_000_000);
    let app = s.client.get_application(&id);
    assert_eq!(app.status, ApplicationStatus::Expired);
}

#[test]
fn refund_expired_before_deadline_fails() {
    let s = setup();
    let deadline = s.env.ledger().timestamp() + 1000;
    let id = s
        .client
        .create_application(&s.applicant, &1, &s.token.address, &100, &deadline);

    let result = s.client.try_refund_expired(&id);
    assert_eq!(result, Err(Ok(Error::DeadlineNotReached)));
}

#[test]
fn dispute_flow_splits_stake_per_resolver_decision() {
    let s = setup();
    let deadline = s.env.ledger().timestamp() + 1000;
    let id = s
        .client
        .create_application(&s.applicant, &1, &s.token.address, &100, &deadline);
    s.client.company_accept_and_stake(&s.company, &id, &200);

    let evidence_hash = BytesN::from_array(&s.env, &[7u8; 32]);
    s.client.open_dispute(
        &s.applicant,
        &id,
        &String::from_str(&s.env, "ipfs://evidence"),
        &evidence_hash,
    );

    let app = s.client.get_application(&id);
    assert_eq!(app.status, ApplicationStatus::Disputed);

    s.client
        .resolve_dispute(&s.resolver, &id, &250, &50);

    assert_eq!(s.token.balance(&s.applicant), 1_000_000 - 100 + 250);
    assert_eq!(s.token.balance(&s.company), 1_000_000 - 200 + 50);
    assert_eq!(s.token.balance(&s.client.address), 0);

    let app = s.client.get_application(&id);
    assert_eq!(app.status, ApplicationStatus::Resolved);
}

#[test]
fn resolve_dispute_rejects_wrong_resolver() {
    let s = setup();
    let deadline = s.env.ledger().timestamp() + 1000;
    let id = s
        .client
        .create_application(&s.applicant, &1, &s.token.address, &100, &deadline);
    s.client.company_accept_and_stake(&s.company, &id, &200);

    let evidence_hash = BytesN::from_array(&s.env, &[1u8; 32]);
    s.client.open_dispute(
        &s.company,
        &id,
        &String::from_str(&s.env, "ipfs://evidence"),
        &evidence_hash,
    );

    let not_resolver = Address::generate(&s.env);
    let result = s
        .client
        .try_resolve_dispute(&not_resolver, &id, &300, &0);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn resolve_dispute_rejects_payout_sum_mismatch() {
    let s = setup();
    let deadline = s.env.ledger().timestamp() + 1000;
    let id = s
        .client
        .create_application(&s.applicant, &1, &s.token.address, &100, &deadline);
    s.client.company_accept_and_stake(&s.company, &id, &200);

    let evidence_hash = BytesN::from_array(&s.env, &[2u8; 32]);
    s.client.open_dispute(
        &s.applicant,
        &id,
        &String::from_str(&s.env, "ipfs://evidence"),
        &evidence_hash,
    );

    let result = s
        .client
        .try_resolve_dispute(&s.resolver, &id, &300, &1);
    assert_eq!(result, Err(Ok(Error::InvalidPayoutSum)));
}

#[test]
fn double_initialize_fails() {
    let s = setup();
    let result = s.client.try_initialize(&s.resolver);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn create_application_rejects_nonpositive_stake() {
    let s = setup();
    let deadline = s.env.ledger().timestamp() + 1000;
    let result =
        s.client
            .try_create_application(&s.applicant, &1, &s.token.address, &0, &deadline);
    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}
