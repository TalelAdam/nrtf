---
name: submission-platform-client
description: Use when integrating with the official Re·Tech Fusion challenge submission platform — POST extraction results / anomaly detections / CO₂ estimates and parse the instant F1 / score response. Trigger on "submit to platform", "challenge endpoint", "F1 feedback", "submission API", "scoreboard".
---

# Re·Tech Fusion Submission Platform

The spec promises an instant F1 / score back via POST. This skill captures the contract and the wrapper code so the team can iterate against the real metric, not a held-out proxy.

## What we know (from the spec)

> "Submission endpoint on the challenge platform: POST your extraction results as JSON — platform returns F1 scores instantly. Same with anomaly / CO2 estimate."

We do not yet know:
- Endpoint URL (will drop with Part 2 announcement)
- Exact JSON shape per task (extraction / anomaly / CO₂)
- Auth (API key? team token?)
- Rate limits

## Recommended client architecture

```python
# apps/doc-extraction/src/submission/client.py
import httpx, json, time, logging
from pathlib import Path
from dataclasses import dataclass

@dataclass
class SubmissionResult:
    f1: float | None
    score: float | None
    detail: dict
    raw_status: int

class RETFSubmissionClient:
    def __init__(self, base_url: str, team_token: str, timeout_s: float = 30):
        self._client = httpx.Client(base_url=base_url,
                                    headers={"Authorization": f"Bearer {team_token}"},
                                    timeout=timeout_s)
        self._log_path = Path("data/processed/submissions.jsonl")
        self._log_path.parent.mkdir(parents=True, exist_ok=True)

    def submit_extraction(self, payload: list[dict], idempotency_key: str | None = None):
        return self._post("/submit/extraction", payload, idempotency_key)

    def submit_anomaly(self, payload: list[dict], idempotency_key: str | None = None):
        return self._post("/submit/anomaly", payload, idempotency_key)

    def submit_co2(self, payload: dict, idempotency_key: str | None = None):
        return self._post("/submit/co2", payload, idempotency_key)

    def _post(self, path, payload, idem):
        for attempt in range(4):
            try:
                r = self._client.post(path, json=payload,
                                      headers={"Idempotency-Key": idem} if idem else {})
                r.raise_for_status()
                data = r.json()
                self._log({"path": path, "ts": time.time(), "status": r.status_code,
                           "f1": data.get("f1"), "detail": data})
                return SubmissionResult(f1=data.get("f1"), score=data.get("score"),
                                        detail=data, raw_status=r.status_code)
            except httpx.HTTPStatusError as e:
                if e.response.status_code in {429, 500, 502, 503, 504} and attempt < 3:
                    time.sleep(2 ** attempt); continue
                raise

    def _log(self, row):
        with self._log_path.open("a") as f: f.write(json.dumps(row) + "\n")
```

## Idempotency

The platform may grade a submission and not allow re-submission of the same payload. Use an idempotency key derived from the canonical hash of the payload:

```python
import hashlib, json
def idem(payload) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
```

If we get a 409 / "already submitted", treat as success (the previous result stands).

## Local F1 mirror (paranoid mode)

When ground truth is provided in the test set, also compute F1 locally so we can debug platform responses:

```python
from sklearn.metrics import f1_score
local_f1 = f1_score(y_true, y_pred, average="micro")
```

Print both `platform.f1` and `local.f1`. If they diverge, our normalization is off.

## Iteration loop

```python
# every K extractions, submit a snapshot
for batch in chunked(extractions, 50):
    res = client.submit_extraction([e.dict() for e in batch], idem=idem(batch))
    log.info(f"batch f1={res.f1:.3f} platform={res.detail}")
```

Don't submit one-at-a-time — usually rate-limited. Don't submit only at the end — you lose the iteration signal.

## Things NOT to do

- Don't store the team token in source. `.env` only.
- Don't retry indefinitely on 4xx — those are our bug, not theirs.
- Don't burn the rate limit experimenting with payload shape. Test on one record first.
- Don't ignore the platform's `detail` payload. It often names the failed field.
- Don't trust a 200 with `f1=null` — treat as a failed submission.

## Hackathon shortcut

Pre-build this client tonight using a mocked `httpx_mock` server returning `{"f1": 0.5, "detail": {}}`. Day 2: change `base_url` and `team_token`, run.
