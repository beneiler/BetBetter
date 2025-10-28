
export function compareOdds(normalizedQuotes) {
  const key = q => [q.eventId, q.selection, q.market].join('|');
  const bestByKey = new Map();

  for (const q of normalizedQuotes) {
    const k = key(q);
    if (!bestByKey.has(k) || q.priceDecimal > bestByKey.get(k).priceDecimal) {
      bestByKey.set(k, q);
    }
  }

  return normalizedQuotes.map(q => {
    const k = key(q);
    const best = bestByKey.get(k);
    return { ...q, isBest: q.book === best.book && q.priceDecimal === best.priceDecimal };
  });
}
