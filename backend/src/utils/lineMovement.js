import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeOdds } from "./normalizeOdds.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LINE_MOVEMENT_PATH = path.join(__dirname, "..", "data", "line_movement.json");
const MOCK_ODDS_PATH = path.join(__dirname, "..", "data", "mock_odds.json");

function readHistory() {
  try {
    const raw = fs.readFileSync(LINE_MOVEMENT_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function writeHistory(history) {
  fs.writeFileSync(LINE_MOVEMENT_PATH, JSON.stringify(history, null, 2));
}

export function captureSnapshot() {
  try {
    const rawOdds = fs.readFileSync(MOCK_ODDS_PATH, "utf-8");
    const mockOdds = JSON.parse(rawOdds);
    const normalized = normalizeOdds(mockOdds);
    const timestamp = new Date().toISOString();
    const history = readHistory();
    
    const snapshots = normalized.map(odds => ({
      timestamp,
      eventId: odds.eventId,
      eventName: odds.eventName,
      selection: odds.selection,
      market: odds.market,
      book: odds.book,
      priceAmerican: odds.priceAmerican
    }));
    
    history.push(...snapshots);
    writeHistory(history);
    
    return { success: true, count: snapshots.length, timestamp };
  } catch (err) {
    console.error("captureSnapshot error:", err);
    return { success: false, error: err.message };
  }
}

export function getLineHistory(eventId, selection, market, book = null) {
  const history = readHistory();
  
  return history.filter(snapshot => {
    const matchesEvent = snapshot.eventId === eventId;
    const matchesSelection = snapshot.selection === selection;
    const matchesMarket = snapshot.market === market;
    const matchesBook = book ? snapshot.book === book : true;
    
    return matchesEvent && matchesSelection && matchesMarket && matchesBook;
  });
}

export function getMovementData(eventId, selection, market) {
  const history = readHistory();
  
  const filtered = history.filter(snapshot => {
    return snapshot.eventId === eventId 
      && snapshot.selection === selection 
      && snapshot.market === market;
  });
  
  const grouped = {};
  filtered.forEach(snapshot => {
    if (!grouped[snapshot.timestamp]) {
      grouped[snapshot.timestamp] = {
        timestamp: snapshot.timestamp,
        eventName: snapshot.eventName,
        books: {}
      };
    }
    grouped[snapshot.timestamp].books[snapshot.book] = snapshot.priceAmerican;
  });
  
  return Object.values(grouped).sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );
}

export function getAvailableEvents() {
  const history = readHistory();
  const events = new Map();
  
  history.forEach(snapshot => {
    if (!events.has(snapshot.eventId)) {
      events.set(snapshot.eventId, {
        eventId: snapshot.eventId,
        eventName: snapshot.eventName
      });
    }
  });
  
  return Array.from(events.values());
}

export function getAvailableSelections(eventId) {
  const history = readHistory();
  const selections = new Set();
  
  history.forEach(snapshot => {
    if (snapshot.eventId === eventId) {
      selections.add(snapshot.selection);
    }
  });
  
  return Array.from(selections);
}

export function getAvailableMarkets(eventId, selection) {
  const history = readHistory();
  const markets = new Set();
  
  history.forEach(snapshot => {
    if (snapshot.eventId === eventId && snapshot.selection === selection) {
      markets.add(snapshot.market);
    }
  });
  
  return Array.from(markets);
}
