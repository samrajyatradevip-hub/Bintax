
/**
 * Chart Data Web Worker
 * Handles heavy historical data generation and aggregation off-thread
 */

export interface ChartDataRequest {
  symbol: string;
  timeframe: number;
  currentPrice: number;
}

self.onmessage = (e: MessageEvent<ChartDataRequest>) => {
  const { symbol, timeframe, currentPrice } = e.data;
  
  const initialData = [];
  let price = currentPrice || (symbol.includes('BTC') ? 65000 : 100);
  const now = Math.floor(Date.now() / 1000);
  const intervalSeconds = timeframe * 60;
  const alignedNow = Math.floor(now / intervalSeconds) * intervalSeconds;
  
  // Higher count for historical context
  const count = 500; 
  
  for (let i = count; i >= 1; i--) {
    const time = (alignedNow - i * intervalSeconds);
    const open = price;
    const volatility = timeframe > 60 ? 0.02 : 0.002;
    const close = open + (Math.random() - 0.5) * (open * volatility);
    const high = Math.max(open, close) + Math.random() * (open * volatility * 0.5);
    const low = Math.min(open, close) - Math.random() * (open * volatility * 0.5);
    
    // Simulate Volume and Open Interest
    const volume = Math.floor(Math.random() * 1000) + 100;
    const openInterest = Math.floor(Math.random() * 5000) + 1000;
    
    initialData.push({ 
        time, 
        open, 
        high, 
        low, 
        close,
        volume,
        openInterest
    });
    price = close;
  }

  // Calculate simulated EMA20 and identify volume spikes
  let ema = initialData[0].close;
  const k = 2 / (20 + 1);
  const processedData = initialData.map((d, i, arr) => {
    ema = d.close * k + ema * (1 - k);
    
    // Simple spike detection: > 3x average of previous 20 periods
    let isSpike = false;
    if (i >= 20) {
      const window = arr.slice(i - 20, i);
      const avgVol = window.reduce((sum, curr) => sum + curr.volume, 0) / window.length;
      isSpike = d.volume > avgVol * 3;
    }
    
    return { ...d, ema20: ema, volumeSpike: isSpike };
  });

  self.postMessage({ 
    data: processedData, 
    lastTime: alignedNow - intervalSeconds 
  });
};
