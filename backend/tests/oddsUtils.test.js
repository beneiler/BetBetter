import assert from 'assert';
import { normalizeOdds } from '../src/utils/normalizeOdds.js';
import { compareOdds } from '../src/utils/compareOdds.js';
import { buildTeamTrends } from '../src/utils/teamTrends.js';

function testNormalizeOdds() {
  const input = [
    { book: 'A', eventId: 'E1', eventName: 'Test', selection: 'Home', market: 'Moneyline', format: 'american', price: 150 },
    { book: 'B', eventId: 'E1', eventName: 'Test', selection: 'Home', market: 'Moneyline', format: 'decimal', price: 2.3 }
  ];

  const out = normalizeOdds(input);
  assert.strictEqual(out.length, 2, 'normalizeOdds should keep same length');
  assert.ok(typeof out[0].priceDecimal === 'number', 'priceDecimal should be a number');
  assert.ok(typeof out[0].priceAmerican === 'number', 'priceAmerican should be a number');
}

function testCompareOdds() {
  const normalized = [
    { book: 'A', eventId: 'E1', eventName: 'Test', selection: 'Home', market: 'Moneyline', priceDecimal: 2.1, priceAmerican: 110 },
    { book: 'B', eventId: 'E1', eventName: 'Test', selection: 'Home', market: 'Moneyline', priceDecimal: 2.4, priceAmerican: 140 }
  ];

  const out = compareOdds(normalized);
  const best = out.find(q => q.isBest);
  assert.ok(best, 'There should be a best line');
  assert.strictEqual(best.book, 'B', 'Book B should be best');
}

function testTeamTrends() {
  const games = [
    {
      teamId: 'CHI',
      teamName: 'Bears',
      opponent: 'Packers',
      date: '2025-09-10',
      moneylineResult: 'win',
      totalResult: 'over',
      closingSpread: 2.5,
      spreadResult: 'cover'
    },
    {
      teamId: 'CHI',
      teamName: 'Bears',
      opponent: 'Lions',
      date: '2025-09-17',
      moneylineResult: 'loss',
      totalResult: 'under',
      closingSpread: -3.5,
      spreadResult: 'no_cover'
    }
  ];

  const trends = buildTeamTrends(games);
  assert.strictEqual(trends.length, 1, 'Should aggregate into one team');
  const bears = trends[0];
  assert.strictEqual(bears.games, 2);
  assert.strictEqual(bears.wins, 1);
  assert.strictEqual(bears.losses, 1);
  assert.ok(bears.winRate > 0 && bears.winRate < 1, 'Win rate should be between 0 and 1');
}

function run() {
  console.log('Running BetBetter backend tests...');
  testNormalizeOdds();
  testCompareOdds();
  testTeamTrends();
  console.log('All tests passed ✅');
}

run();
