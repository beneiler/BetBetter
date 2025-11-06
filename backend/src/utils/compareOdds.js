
export function compareOdds(normalizedQuotes) {
  const makeKey = q => [q.eventId, q.selection, q.market].join('|');

  const bestByKey = new Map();
  for (const q of normalizedQuotes) {
    const key = makeKey(q);
    const currentBest = bestByKey.get(key);
    if (!currentBest || q.priceDecimal > currentBest.priceDecimal) {
      bestByKey.set(key, q);
    }
  }

  return normalizedQuotes.map(q => {
    const key = makeKey(q);
    const best = bestByKey.get(key);
    const isBest =
      best &&
      q.book === best.book &&
      q.priceDecimal === best.priceDecimal;

    return { ...q, isBest };
  });
}