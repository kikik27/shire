# Shire Candidate Guide

## Candidate Onboarding

Candidate mode is for finding work. A user creates or opens a candidate profile and may upload a CV to produce an AI-assisted profile draft.

## CV and Profile Review

The CV draft is not final. The candidate reviews, edits, and confirms the profile before it becomes eligible for matching. Missing or unsupported facts must not be invented.

## Job Recommendations

Shire compares a confirmed candidate profile with active jobs. Recommendations explain matching skills, requirements, gaps, confidence, and relevant risks. Jobs owned by a company the user manages must be excluded.

## Applying

The candidate chooses whether to apply. Shire must not apply automatically. Before an escrowed application is created, the UI shows the required transaction and the candidate approves it in their wallet.

## Candidate Stake

The candidate stake is locked by the supported Stellar (Soroban) escrow contract for that application. The assistant must not invent an amount, token, fee, or deadline when the current job or application context does not provide one.

## Application Status

The candidate can review application state, company acceptance, stake state, completion state, expiration, and dispute status for applications they are authorized to access.

## Completion and Refund

The supported completion flow releases escrow after the required confirmations. If the company does not respond before an applicable deadline, the candidate may use the supported expired refund flow.

## Candidate Disputes

The candidate may open a dispute and submit evidence. AI summarizes the evidence but does not decide fault or payout. An authorized resolver makes the final decision.

## Candidate AI Boundaries

AI cannot submit an application, sign a transaction, confirm completion, open a dispute, or accept a settlement for the candidate.
