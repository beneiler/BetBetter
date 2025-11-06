export function normalizeOdds(quotes) {
  return quotes.map(q => {
    const fmt = (q.format || '').toLowerCase();
    let priceDecimal;
    let priceAmerican;

    if (fmt === 'decimal') {
      priceDecimal = Number(q.price);
      priceAmerican = decimalToAmerican(priceDecimal);
    } else if (fmt === 'american' || fmt === 'moneyline') {
      priceAmerican = Number(q.price);
      priceDecimal = americanToDecimal(priceAmerican);
    } else {
      // Default: assume decimal if unknown
      priceDecimal = Number(q.price);
      priceAmerican = decimalToAmerican(priceDecimal);
    }

    return {
      book: q.book,
      eventId: q.eventId,
      eventName: q.eventName,
      selection: q.selection,
      market: q.market,
      priceDecimal: round(priceDecimal, 4),
      priceAmerican: Math.round(priceAmerican)
    };
  });
}

function americanToDecimal(american) {
  if (american > 0) return 1 + american / 100.0;
  return 1 + 100.0 / Math.abs(american);
}

function decimalToAmerican(decimal) {
  if (decimal >= 2.0) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

function round(n, dp = 2) {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}