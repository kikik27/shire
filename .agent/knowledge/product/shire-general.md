# Shire Product Guide

## What Shire Is

Shire is an AI-assisted hiring marketplace with wallet-based identity and stablecoin escrow on Stellar (Soroban). A user may look for jobs, recruit talent, or use both modes.

## Core Principle

AI finds and explains opportunities. Users approve important actions. The smart contract locks escrowed stakes. Workflows track application state. Human reviewers resolve disputes. The contract settles funds.

## Identity and Modes

One wallet represents one Shire user identity. The same user may have a candidate profile and may own or manage one or more companies or agencies. Switching mode changes the active product context, not permanent permissions.

## AI Responsibilities

AI may draft candidate profiles, explain matches, recommend jobs or talent, and summarize dispute evidence. AI cannot sign wallet transactions, apply or invite without approval, make final hiring decisions, resolve disputes, or move escrowed funds.

## Matching

Shire combines deterministic eligibility checks with skill and requirement matching. Match explanations may include aligned skills, missing requirements, confidence, and risk flags. A recommendation is guidance, not a hiring decision.

## Application and Escrow Lifecycle

A candidate chooses a job and approves an applicant stake transaction. A company may accept and approve its company stake. The contract records application state and locks funds until completion, expiration, cancellation, or dispute settlement.

## Completion, Expiration, and Refunds

Normal completion requires the supported confirmation flow before escrow is released. If a company does not respond before the configured deadline, an eligible applicant may request the supported expired-application refund flow.

## Disputes

Candidates or companies may open a dispute and submit evidence. AI can summarize evidence and timelines but cannot choose a winner. An authorized human resolver reviews the case and submits the settlement decision.

## Onchain and Offchain Data

Escrow state and settlement events are onchain. Profiles, CV content, job descriptions, recommendations, and private evidence remain offchain. Sensitive profile or CV data must not be written onchain.

## Security and Privacy

Users approve wallet transactions themselves. Shire does not treat AI output as authorization. Product access is determined by authenticated identity, company membership, and resource ownership.

## Frequently Asked Questions

### Can Shire apply or stake automatically?

No. The user must approve important actions and sign wallet transactions.

### Does a user have one permanent role?

No. A user can use candidate mode, recruiter mode, or both.

### Does AI decide disputes?

No. AI only summarizes evidence for human review.

### Are CVs stored onchain?

No. Sensitive candidate and application data remains offchain.
