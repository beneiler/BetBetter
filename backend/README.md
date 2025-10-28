
# BetBetter Backend (MVP)

Implements:
- **T1** API Data Retrieval — uses `src/data/mock_odds.json` as a source.
- **T2** Data Normalization — converts mixed American/Decimal odds into a common model.
- **T3** Odds Comparison — flags the best decimal price per (event, selection, market).
- **T4** UI served from `/frontend` for convenience.

## Run locally

```bash
cd backend
npm install
npm run start
# open http://localhost:3000
```

### Endpoints
- `GET /api/health` — health check
- `GET /api/odds` — returns normalized + compared odds

The static frontend is also hosted by the same server for simplicity.
