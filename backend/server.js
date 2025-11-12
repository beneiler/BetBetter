import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeOdds } from './src/utils/normalizeOdds.js';
import { compareOdds } from './src/utils/compareOdds.js';
import { buildTeamTrends } from './src/utils/teamTrends.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'betbetter-backend' });
});

// Odds endpoint (mock data -> normalize -> compare)
app.get('/api/odds', (_req, res) => {
  try {
    const dataPath = path.join(__dirname, 'src', 'data', 'mock_odds.json');
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(raw);

    const normalized = normalizeOdds(data);
    const compared = compareOdds(normalized);

    res.json({ meta: { count: compared.length }, data: compared });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load odds' });
  }
});

// Team trends endpoint
app.get('/api/team-trends', (_req, res) => {
  try {
    const dataPath = path.join(__dirname, 'src', 'data', 'team_history.json');
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const games = JSON.parse(raw);
    const trends = buildTeamTrends(games);

    res.json({
      meta: { count: trends.length },
      data: trends
    });
  } catch (err) {
    console.error('Error loading team trends:', err);
    res.status(500).json({ error: 'Failed to load team trends' });
  }
});

// Serve frontend
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BetBetter backend listening on http://localhost:${PORT}`);
});
