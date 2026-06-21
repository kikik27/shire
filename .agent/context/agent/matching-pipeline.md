# Matching Pipeline

Pipeline matching tidak boleh hanya mengandalkan LLM.

Use:

```txt
Filter → Retrieve → Rule Score → AI Rerank → Save Recommendation
```

## Filter

### Candidate-to-job
```txt
- CandidateProfile must be CONFIRMED
- Job must be ACTIVE
- User must not be member of job company
- Candidate must not already apply
- Recommendation must not be rejected recently
```

### Company-to-talent
```txt
- Job must be ACTIVE
- CandidateProfile must be CONFIRMED
- Candidate user must not be company member
- Company must not already invite candidate recently
```

## Rule score
```txt
Skill match: 40%
Experience match: 20%
Location/work preference: 15%
Salary fit: 10%
Portfolio/history: 10%
Risk adjustment: 5%
```

## Action threshold
```txt
score >= 85:
Strong recommendation, notify user/company.

score 70-84:
Save recommendation, show in dashboard.

score < 70:
Ignore.
```
# Retrieval-first model usage

Matching applies deterministic hard filters and documented rule scores before
any model call. Vector retrieval narrows the candidate set. Only the reduced
set may use the configured reranking capability. Broad candidate/job retrieval
never invokes an LLM.
