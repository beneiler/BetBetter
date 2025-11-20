// backend/src/utils/metrics.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Load & normalize from your team_history.json ---
function loadTeamGames(teamId) {
  const p = path.join(__dirname, "..", "data", "team_history.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));

  const games = raw
    .filter(r => !teamId || r.teamId === teamId)
    .map(r => ({
      gameId: `${r.teamId}-${r.opponent}-${r.date}`,
      teamId: r.teamId,
      date: r.date, // ISO date
      // Convert your moneyline result to W/L
      result: r.moneylineResult === "win" ? "W" : r.moneylineResult === "loss" ? "L" : "NA",
      // Convert your total result to OVER/UNDER (no pushes in current data)
      ouOutcome: r.totalResult === "over" ? "OVER" : r.totalResult === "under" ? "UNDER" : null
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return games;
}

// --- Metrics ---
function rollingWinRate(games, window) {
  const out = [];
  let wins = 0;
  const q = [];
  for (const g of games) {
    q.push(g);
    if (g.result === "W") wins++;
    if (q.length > window) {
      const old = q.shift();
      if (old.result === "W") wins--;
    }
    if (q.length === window) out.push({ asOf: g.date, value: wins / window });
  }
  return out;
}

function rollingOUHitRate(games, window, kind = "OVER") {
  const out = [];
  const q = [];
  let hits = 0;
  let considered = 0;

  for (const g of games) {
    const r = g.ouOutcome ?? null;
    let item = "SKIP";
    if (r && r !== "PUSH") item = r === kind ? "HIT" : "MISS";

    q.push(item);
    if (item !== "SKIP") {
      considered++;
      if (item === "HIT") hits++;
    }
    while (q.length > window) {
      const old = q.shift();
      if (old !== "SKIP") {
        considered--;
        if (old === "HIT") hits--;
      }
    }
    if (q.length === window && considered > 0) {
      out.push({ asOf: g.date, value: hits / considered });
    }
  }
  return out;
}

function streakSeries(games) {
  const out = [];
  let streak = 0;
  let last = null; // "W" | "L" | null
  for (const g of games) {
    if (g.result === "W") {
      streak = last === "W" ? streak + 1 : 1;
      last = "W";
    } else if (g.result === "L") {
      streak = last === "L" ? streak - 1 : -1;
      last = "L";
    }
    out.push({ asOf: g.date, value: streak });
  }
  return out;
}

// Public function used by the route
export function getMetricSeries(teamId, metric, windowSize = 5, kind = "OVER") {
  const games = loadTeamGames(teamId);
  switch (metric) {
    case "rolling_win_rate":
      return rollingWinRate(games, windowSize);
    case "rolling_ou_hit_rate":
      return rollingOUHitRate(games, windowSize, kind);
    case "streak_len":
      return streakSeries(games);
    default:
      throw new Error(`unknown metric: ${metric}`);
  }
}

export { loadTeamGames, rollingWinRate, rollingOUHitRate, streakSeries };
