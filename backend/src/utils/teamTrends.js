export function buildTeamTrends(games) {
  const byTeam = new Map();

  for (const g of games) {
    if (!byTeam.has(g.teamId)) {
      byTeam.set(g.teamId, {
        teamId: g.teamId,
        teamName: g.teamName,
        games: 0,
        wins: 0,
        losses: 0,
        overs: 0,
        unders: 0,
        covers: 0,
        noCovers: 0,
        totalSpread: 0
      });
    }

    const t = byTeam.get(g.teamId);
    t.games++;
    if (g.moneylineResult === 'win') t.wins++;
    if (g.moneylineResult === 'loss') t.losses++;
    if (g.totalResult === 'over') t.overs++;
    if (g.totalResult === 'under') t.unders++;
    if (g.spreadResult === 'cover') t.covers++;
    if (g.spreadResult === 'no_cover') t.noCovers++;
    if (typeof g.closingSpread === 'number') t.totalSpread += g.closingSpread;
  }

  return Array.from(byTeam.values()).map(t => ({
    ...t,
    winRate: round(t.wins / t.games, 3),
    overRate: round(t.overs / t.games, 3),
    coverRate: round(t.covers / t.games, 3),
    avgClosingSpread: round(t.totalSpread / t.games, 2)
  }));
}

function round(n, dp) {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
