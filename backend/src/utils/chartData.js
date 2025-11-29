export function buildLineChart(history) {
  if (!history || history.length === 0) {
    return {
      labels: [],
      datasets: [],
      isEmpty: true
    };
  }

  const allBooks = new Set();
  history.forEach(snapshot => {
    Object.keys(snapshot.books).forEach(book => allBooks.add(book));
  });

  const labels = history.map(snapshot => {
    const date = new Date(snapshot.timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  });

  const colors = [
    '#4CAF50',
    '#2196F3',
    '#FF9800',
    '#E91E63',
    '#9C27B0',
    '#00BCD4',
    '#FF5722',
    '#795548'
  ];

  const datasets = Array.from(allBooks).map((book, index) => {
    const data = history.map(snapshot => snapshot.books[book] || null);
    
    return {
      label: book,
      data,
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '33',
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2,
      spanGaps: true
    };
  });

  return {
    labels,
    datasets,
    isEmpty: false
  };
}

export function calculateMovementMetrics(history) {
  if (!history || history.length === 0) {
    return {
      totalSnapshots: 0,
      timeSpan: null,
      movements: []
    };
  }

  const metrics = {
    totalSnapshots: history.length,
    timeSpan: {
      start: history[0].timestamp,
      end: history[history.length - 1].timestamp,
      durationMs: new Date(history[history.length - 1].timestamp) - new Date(history[0].timestamp)
    },
    movements: []
  };

  const allBooks = new Set();
  history.forEach(snapshot => {
    Object.keys(snapshot.books).forEach(book => allBooks.add(book));
  });

  allBooks.forEach(book => {
    const bookData = history
      .map(snapshot => ({ timestamp: snapshot.timestamp, price: snapshot.books[book] }))
      .filter(d => d.price !== undefined);

    if (bookData.length === 0) return;

    const prices = bookData.map(d => d.price);
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const delta = lastPrice - firstPrice;
    const timeSpanHours = metrics.timeSpan.durationMs / (1000 * 60 * 60);
    const velocity = timeSpanHours > 0 ? delta / timeSpanHours : 0;
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const maxIndex = prices.indexOf(max);
    const minIndex = prices.indexOf(min);

    metrics.movements.push({
      book,
      firstPrice,
      lastPrice,
      delta,
      deltaPercent: firstPrice !== 0 ? (delta / Math.abs(firstPrice)) * 100 : 0,
      velocity,
      peak: {
        price: max,
        timestamp: bookData[maxIndex].timestamp
      },
      trough: {
        price: min,
        timestamp: bookData[minIndex].timestamp
      },
      volatility: max - min
    });
  });

  return metrics;
}

export function aggregateByTimeWindow(history, windowHours) {
  if (!history || history.length === 0) {
    return [];
  }

  const now = new Date();
  const cutoffTime = new Date(now.getTime() - (windowHours * 60 * 60 * 1000));

  return history.filter(snapshot => {
    const snapshotTime = new Date(snapshot.timestamp);
    return snapshotTime >= cutoffTime;
  });
}

export function detectSignificantMovements(history, threshold = 10) {
  if (!history || history.length < 2) {
    return [];
  }

  const movements = [];
  const allBooks = new Set();
  
  history.forEach(snapshot => {
    Object.keys(snapshot.books).forEach(book => allBooks.add(book));
  });

  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];

    allBooks.forEach(book => {
      const prevPrice = prev.books[book];
      const currPrice = curr.books[book];

      if (prevPrice !== undefined && currPrice !== undefined) {
        const change = Math.abs(currPrice - prevPrice);
        
        if (change >= threshold) {
          movements.push({
            book,
            fromTimestamp: prev.timestamp,
            toTimestamp: curr.timestamp,
            fromPrice: prevPrice,
            toPrice: currPrice,
            change: currPrice - prevPrice,
            changeAbs: change
          });
        }
      }
    });
  }

  return movements;
}
