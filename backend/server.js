import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { normalizeOdds } from "./src/utils/normalizeOdds.js";
import { compareOdds } from "./src/utils/compareOdds.js";
import { buildTeamTrends } from "./src/utils/teamTrends.js";
import { getMetricSeries } from "./src/utils/metrics.js";
import { 
  captureSnapshot, 
  getLineHistory, 
  getMovementData,
  getAvailableEvents,
  getAvailableSelections,
  getAvailableMarkets
} from "./src/utils/lineMovement.js";
import { 
  buildLineChart, 
  calculateMovementMetrics, 
  aggregateByTimeWindow,
  detectSignificantMovements
} from "./src/utils/chartData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "betbetter-backend" });
});

// Odds endpoint (mock)
app.get("/api/odds", (_req, res) => {
  try {
    const dataPath = path.join(__dirname, "src", "data", "mock_odds.json");
    const raw = fs.readFileSync(dataPath, "utf-8");
    const data = JSON.parse(raw);

    const normalized = normalizeOdds(data);
    const compared = compareOdds(normalized);

    res.json({ meta: { count: compared.length }, data: compared });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed_to_load_odds" });
  }
});

// Team trends (aggregate snapshot per team)
app.get("/api/team-trends", (_req, res) => {
  try {
    const dataPath = path.join(__dirname, "src", "data", "team_history.json");
    const raw = fs.readFileSync(dataPath, "utf-8");
    const games = JSON.parse(raw);
    const trends = buildTeamTrends(games);

    res.json({ meta: { count: trends.length }, data: trends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed_to_load_team_trends" });
  }
});

// NEW: Metrics time-series (rolling win rate, OU hit rate, streak)
app.get("/api/metrics", (req, res) => {
  try {
    const teamId = String(req.query.teamId || "").trim();
    if (!teamId) return res.status(400).json({ error: "teamId is required" });

    const metric = String(req.query.metric || "rolling_win_rate"); // rolling_win_rate | rolling_ou_hit_rate | streak_len
    const windowSize = Math.max(1, parseInt(req.query.window || "5", 10));
    const kind = (String(req.query.kind || "OVER").toUpperCase() === "UNDER") ? "UNDER" : "OVER";

    const points = getMetricSeries(teamId, metric, windowSize, kind);
    res.json({ teamId, metric, window: windowSize, points });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal_error", detail: err.message });
  }
});

app.post("/api/line-movement/snapshot", (req, res) => {
  try {
    const result = captureSnapshot();
    if (result.success) {
      res.json({ 
        success: true, 
        message: `Captured ${result.count} odds snapshots`,
        timestamp: result.timestamp,
        count: result.count
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "snapshot_failed", detail: err.message });
  }
});

app.get("/api/line-movement/history", (req, res) => {
  try {
    const eventId = String(req.query.eventId || "").trim();
    const selection = String(req.query.selection || "").trim();
    const market = String(req.query.market || "").trim();
    const book = req.query.book ? String(req.query.book).trim() : null;

    if (!eventId || !selection || !market) {
      return res.status(400).json({ 
        error: "eventId, selection, and market are required" 
      });
    }

    const history = getLineHistory(eventId, selection, market, book);
    res.json({ 
      eventId, 
      selection, 
      market, 
      book: book || "all", 
      count: history.length, 
      data: history 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "history_failed", detail: err.message });
  }
});

app.get("/api/line-movement/chart-data", (req, res) => {
  try {
    const eventId = String(req.query.eventId || "").trim();
    const selection = String(req.query.selection || "").trim();
    const market = String(req.query.market || "").trim();
    const windowHours = req.query.window ? parseInt(req.query.window, 10) : null;

    if (!eventId || !selection || !market) {
      return res.status(400).json({ 
        error: "eventId, selection, and market are required" 
      });
    }

    let movementData = getMovementData(eventId, selection, market);

    if (windowHours && windowHours > 0) {
      movementData = aggregateByTimeWindow(movementData, windowHours);
    }

    const chartData = buildLineChart(movementData);
    const metrics = calculateMovementMetrics(movementData);
    const significantMovements = detectSignificantMovements(movementData);

    res.json({
      eventId,
      selection,
      market,
      window: windowHours || "all",
      chartData,
      metrics,
      significantMovements,
      dataPoints: movementData.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "chart_data_failed", detail: err.message });
  }
});

app.get("/api/line-movement/events", (req, res) => {
  try {
    const events = getAvailableEvents();
    res.json({ count: events.length, data: events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "events_failed", detail: err.message });
  }
});

app.get("/api/line-movement/selections", (req, res) => {
  try {
    const eventId = String(req.query.eventId || "").trim();
    if (!eventId) {
      return res.status(400).json({ error: "eventId is required" });
    }
    
    const selections = getAvailableSelections(eventId);
    res.json({ eventId, count: selections.length, data: selections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "selections_failed", detail: err.message });
  }
});

app.get("/api/line-movement/markets", (req, res) => {
  try {
    const eventId = String(req.query.eventId || "").trim();
    const selection = String(req.query.selection || "").trim();
    
    if (!eventId || !selection) {
      return res.status(400).json({ error: "eventId and selection are required" });
    }
    
    const markets = getAvailableMarkets(eventId, selection);
    res.json({ eventId, selection, count: markets.length, data: markets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "markets_failed", detail: err.message });
  }
});


app.use("/", express.static(path.join(__dirname, "..", "frontend")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BetBetter backend listening on http://localhost:${PORT}`);
});
