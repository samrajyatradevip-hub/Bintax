/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Bell, 
  ChevronDown, 
  Plus, 
  Minus, 
  LineChart as ChartIcon, 
  HelpCircle, 
  User, 
  Trophy, 
  Menu,
  Diamond,
  Briefcase,
  LucideIcon,
  MousePointer2,
  PenTool,
  LineChart,
  Eye,
  Settings2,
  Undo2,
  Trash2,
  LogOut,
  History,
  ShieldCheck,
  Frown,
  Sparkles,
  CreditCard,
  ArrowRight,
  X,
  Wallet,
  Banknote,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Target,
  Type,
  Layers,
  Download
} from 'lucide-react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, CandlestickData, UTCTimestamp, IChartApi, ISeriesApi, SeriesMarker, createSeriesMarkers } from 'lightweight-charts';
import { Auth } from './components/Auth';
import { TradeHistory } from './components/TradeHistory';
import { Profile } from './components/Profile';

// --- Types ---

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Point {
  x: number;
  y: number;
}

interface DrawingLine {
  id: string;
  start: Point;
  end: Point;
  color: string;
}

// --- Utils ---

const AVAILABLE_ASSETS = [
  { id: 'FX:EURNZD', name: 'EUR/NZD (OTC)', payout: 78, symbol: '€/NZ$' },
  { id: 'FX:EURUSD', name: 'EUR/USD (OTC)', payout: 91, symbol: '€/$' },
  { id: 'FX:GBPUSD', name: 'GBP/USD (OTC)', payout: 88, symbol: '£/$' },
  { id: 'BINANCE:BTCUSDT', name: 'BTC/USD', payout: 82, symbol: '₿' },
  { id: 'BINANCE:ETHUSDT', name: 'ETH/USD', payout: 80, symbol: 'Ξ' },
  { id: 'OANDA:XAUUSD', name: 'GOLD', payout: 75, symbol: 'Au' },
];

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(val);
};

// --- Components ---

const TIMEFRAMES = [
  { label: '1m', value: 1 },
  { label: '5m', value: 5 },
  { label: '15m', value: 15 },
  { label: '1h', value: 60 },
  { label: '1d', value: 1440 },
];

type DrawingType = 'line' | 'fib' | 'text' | 'none';

interface Drawing {
  id: string;
  type: DrawingType;
  points: { time: number; price: number }[];
  text?: string;
  color: string;
}

const TradingViewChart = ({ symbol, currentPrice }: { symbol: string, currentPrice?: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const markersApiRef = useRef<any>(null);
  const dataRef = useRef<any[]>([]);
  const lastTimeRef = useRef<number>(0);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const bufferedPriceRef = useRef<number | undefined>(currentPrice);
  
  const [timeframe, setTimeframe] = useState(1);
  const [activeTool, setActiveTool] = useState<DrawingType>('none');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<Drawing | null>(null);
  
  const [hoverData, setHoverData] = useState<{ 
    price: number;
    time: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    openInterest?: number;
    ema20?: number;
  } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ price: number, time: string } | null>(null);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [trades, setTrades] = useState<any[]>([]);

  // Fetch trades to display markers
  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch('/api/trades');
        if (response.ok) {
          const data = await response.json();
          setTrades(data.trades);
        }
      } catch (err) {
        console.error('Failed to fetch trades for markers', err);
      }
    };
    fetchTrades();
    // Refresh trades periodically or on mount
    const interval = setInterval(fetchTrades, 10000);
    
    // Immediate refresh on custom event
    const handleTradeExecuted = () => fetchTrades();
    window.addEventListener('trade-executed', handleTradeExecuted);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('trade-executed', handleTradeExecuted);
    };
  }, []);

  const updateMarkers = useCallback((chartData: any[], userTrades: any[]) => {
    if (!seriesRef.current || !markersApiRef.current) return;

    const markers: SeriesMarker<UTCTimestamp>[] = [];

    // Volume Spike Markers
    chartData.forEach(d => {
      if (d.volumeSpike) {
        markers.push({
          time: d.time,
          position: 'belowBar',
          color: '#3b82f6',
          shape: 'arrowUp',
          text: 'VOL SPIKE',
          size: 1
        });
      }
    });

    // Trade Execution Markers
    userTrades.forEach(trade => {
      // Filter trades for current symbol
      if (trade.asset !== symbol && !symbol.includes(trade.asset)) return;

      const intervalSeconds = timeframe * 60;
      const tradeTime = Math.floor(trade.time / 1000);
      const alignedTime = Math.floor(tradeTime / intervalSeconds) * intervalSeconds;

      // Only add if trade time is within our data range
      if (chartData.some(d => d.time === alignedTime)) {
        markers.push({
          time: alignedTime as UTCTimestamp,
          position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
          color: trade.status === 'win' ? '#22c55e' : (trade.status === 'loss' ? '#ef4444' : '#4589ff'),
          shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
          text: `${trade.type === 'buy' ? 'BUY' : 'SELL'} @ ${trade.amount}`,
          size: 2
        });
      }
    });

    // Sort markers by time
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    markersApiRef.current.setMarkers(markers);
  }, [symbol, timeframe]);

  // Sync buffered price with currentPrice prop
  useEffect(() => {
    bufferedPriceRef.current = currentPrice;
  }, [currentPrice]);

  // Batch chart updates (throttled to 10hz max)
  useEffect(() => {
    const updateInterval = setInterval(() => {
      const price = bufferedPriceRef.current;
      if (seriesRef.current && price !== undefined) {
        const now = Math.floor(Date.now() / 1000);
        const intervalSeconds = timeframe * 60;
        const time = Math.floor(now / intervalSeconds) * intervalSeconds;
        
        if (time < lastTimeRef.current) return;
        lastTimeRef.current = time;
        
        try {
          seriesRef.current.update({
            time: time as UTCTimestamp,
            open: price,
            high: price,
            low: price,
            close: price,
          });
        } catch (err) {
          // Silent catch for race conditions during unmount
        }
      }
    }, 100);

    return () => clearInterval(updateInterval);
  }, [timeframe]);

  // Sync drawing layer with chart movement
  const updateDrawings = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const canvas = overlayCanvasRef.current;
    if (!chart || !series || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const timeScale = chart.timeScale();

    const drawItem = (drawing: Drawing) => {
      const p1 = drawing.points[0];
      const x1 = timeScale.timeToCoordinate(p1.time as UTCTimestamp);
      const y1 = series.priceToCoordinate(p1.price);

      if (x1 === null || y1 === null) return;

      ctx.strokeStyle = drawing.color;
      ctx.fillStyle = drawing.color;
      ctx.lineWidth = 2;

      if (drawing.type === 'line' && drawing.points.length > 1) {
        const p2 = drawing.points[1];
        const x2 = timeScale.timeToCoordinate(p2.time as UTCTimestamp);
        const y2 = series.priceToCoordinate(p2.price);
        if (x2 !== null && y2 !== null) {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          // Glow effect
          ctx.shadowBlur = 10;
          ctx.shadowColor = drawing.color;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else if (drawing.type === 'fib' && drawing.points.length > 1) {
        const p2 = drawing.points[1];
        const x2 = timeScale.timeToCoordinate(p2.time as UTCTimestamp);
        const y2 = series.priceToCoordinate(p2.price);
        if (x2 !== null && y2 !== null) {
          const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const diff = p2.price - p1.price;
          
          levels.forEach(level => {
            const levelPrice = p1.price + diff * level;
            const ly = series.priceToCoordinate(levelPrice);
            if (ly !== null) {
              ctx.setLineDash([5, 5]);
              ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + level * 0.3})`;
              ctx.beginPath();
              ctx.moveTo(Math.min(x1, x2), ly);
              ctx.lineTo(Math.max(x1, x2), ly);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.font = '9px Inter';
              ctx.fillStyle = '#9ca3af';
              ctx.fillText(`${(level * 100).toFixed(1)}% (${levelPrice.toFixed(2)})`, Math.max(x1, x2) + 5, ly + 3);
            }
          });
          // Draw bounding box
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
          ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        }
      } else if (drawing.type === 'text') {
        ctx.font = '12px Inter';
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#000000';
        ctx.fillText(drawing.text || 'Annotation', x1 + 5, y1 - 5);
        ctx.shadowBlur = 0;
        // Small point indicator
        ctx.beginPath();
        ctx.arc(x1, y1, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawings.forEach(drawItem);
    if (currentDrawing) drawItem(currentDrawing);
  }, [drawings, currentDrawing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'none') return;
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!canvas || !chart || !series) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = chart.timeScale().coordinateToTime(x) as number;
    const price = series.coordinateToPrice(y);

    if (time && price) {
      if (activeTool === 'text') {
        const text = prompt('Enter annotation:');
        if (text) {
          setDrawings([...drawings, {
            id: Math.random().toString(36),
            type: 'text',
            points: [{ time, price }],
            text,
            color: '#3b82f6'
          }]);
        }
        setActiveTool('none');
      } else {
        setCurrentDrawing({
          id: 'temp',
          type: activeTool,
          points: [{ time, price }, { time, price }],
          color: activeTool === 'fib' ? '#f59e0b' : '#3b82f6'
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!currentDrawing) return;
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!canvas || !chart || !series) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = chart.timeScale().coordinateToTime(x) as number;
    const price = series.coordinateToPrice(y);

    if (time && price) {
      setCurrentDrawing({
        ...currentDrawing,
        points: [currentDrawing.points[0], { time, price }]
      });
    }
  };

  const handleMouseUp = () => {
    if (currentDrawing) {
      setDrawings([...drawings, { ...currentDrawing, id: Math.random().toString(36) }]);
      setCurrentDrawing(null);
      // Optional: keep tool active for multiple drawings
      // setActiveTool('none'); 
    }
  };

  useEffect(() => {
    updateDrawings();
  }, [drawings, currentDrawing, timeframe, updateDrawings]);

  useEffect(() => {
    if (currentPrice !== undefined) {
      if (lastPrice !== null) {
        if (currentPrice > lastPrice) setPriceDirection('up');
        else if (currentPrice < lastPrice) setPriceDirection('down');
      }
      setLastPrice(currentPrice);
      
      const timer = setTimeout(() => setPriceDirection(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentPrice]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#6b7280',
        fontSize: 10,
        fontFamily: 'Inter',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: '#3b82f6',
          width: 1,
          style: 1,
          labelBackgroundColor: '#3b82f6',
        },
        horzLine: {
          color: '#3b82f6',
          width: 1,
          style: 1,
          labelBackgroundColor: '#3b82f6',
        },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: timeframe < 60,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      handleScale: true,
      handleScroll: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay mode
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const emaSeries = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Use Web Worker for historical data generation
    setIsDataLoading(true);
    const worker = new Worker(new URL('./workers/chartDataWorker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e) => {
      const { data, lastTime } = e.data;
      dataRef.current = data;
      if (seriesRef.current && volumeSeriesRef.current && emaSeriesRef.current) {
        seriesRef.current.setData(data);
        volumeSeriesRef.current.setData(data.map((d: any) => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'
        })));
        emaSeriesRef.current.setData(data.map((d: any) => ({
          time: d.time,
          value: d.ema20
        })));
        
        lastTimeRef.current = lastTime;
        updateMarkers(data, trades);
        setIsDataLoading(false);
      }
      worker.terminate();
    };

    worker.postMessage({
      symbol,
      timeframe,
      currentPrice: currentPrice || (symbol.includes('BTC') ? 65000 : 100)
    });

    // Event Subscriptions
    chart.subscribeClick((param) => {
      if (param.time && param.point) {
        const p = series.coordinateToPrice(param.point.y);
        if (p) {
          const date = new Date((param.time as number) * 1000).toLocaleString();
          setSelectedPoint({ price: p, time: date });
        }
      } else {
        setSelectedPoint(null);
      }
    });

    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.point) {
        const candle = param.seriesData.get(series) as any;
        const vol = param.seriesData.get(volumeSeries) as any;
        const ema = param.seriesData.get(emaSeries) as any;
        
        // Find custom data (like Open Interest) from our reference
        const customData = dataRef.current.find(d => d.time === param.time);
        
        const p = series.coordinateToPrice(param.point.y);
        if (p) {
          const date = new Date((param.time as number) * 1000).toLocaleString();
          setHoverData({ 
            price: p, 
            time: date,
            open: candle?.open,
            high: candle?.high,
            low: candle?.low,
            close: candle?.close,
            volume: vol?.value,
            ema20: ema?.value,
            openInterest: customData?.openInterest
          });
        }
      } else {
        setHoverData(null);
      }
    });

    chartRef.current = chart;
    seriesRef.current = series;
    volumeSeriesRef.current = volumeSeries;
    emaSeriesRef.current = emaSeries;
    markersApiRef.current = createSeriesMarkers(series);

    // Subscribe to time scale changes to re-draw overlay
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      updateDrawings();
    });

    // Use ResizeObserver for more robust dimension tracking
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
        setDimensions({ width, height });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersApiRef.current = null;
      lastTimeRef.current = 0;
    };
  }, [symbol, timeframe, updateDrawings, updateMarkers, trades]);

  // Update markers whenever trades change
  useEffect(() => {
    if (dataRef.current.length > 0) {
      updateMarkers(dataRef.current, trades);
    }
  }, [trades, updateMarkers]);

  const formatPrice = (p: number) => {
    if (symbol.includes('BTC') || symbol.includes('ETH')) {
      return p.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
    }
    return p.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 4 });
  };

  const exportChart = () => {
    const chart = chartRef.current;
    const overlay = overlayCanvasRef.current;
    if (!chart || !overlay) return;

    const chartCanvas = chart.takeScreenshot();
    if (!chartCanvas) return;

    // Create a composition canvas
    const compositionCanvas = document.createElement('canvas');
    compositionCanvas.width = chartCanvas.width;
    compositionCanvas.height = chartCanvas.height;
    const ctx = compositionCanvas.getContext('2d');
    if (!ctx) return;

    // Draw chart
    ctx.drawImage(chartCanvas, 0, 0);

    // Draw drawings overlay
    // We need to match the scale of screenshot (DPR)
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    ctx.drawImage(overlay, 0, 0);

    // Trigger download
    const link = document.createElement('a');
    link.download = `chart-${symbol}-${timeframe}m-${Date.now()}.png`;
    link.href = compositionCanvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="w-full h-full bg-[#0b0e14] relative flex flex-col">
      {/* Top Status Bar */}
      <div className="h-12 border-b border-white/5 flex items-center px-4 justify-between bg-[#11141b]/50 backdrop-blur-sm z-30">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center border border-blue-500/20">
              <TrendingUp size={14} className="text-blue-400" />
            </div>
            <div className="flex flex-col min-w-max">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Market</span>
              <span className="text-xs font-black text-white">{symbol.split(':')[1] || symbol}</span>
            </div>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-2 py-1 rounded-md text-[10px] font-black transition-all ${
                  timeframe === tf.value 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          
          {hoverData && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 bg-white/5 px-3 py-1 rounded-lg border border-white/5 min-w-max"
            >
              <div className="flex items-center gap-4 border-r border-white/10 pr-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">Cursor</span>
                  <span className="text-[10px] font-black text-white tabular-nums">{formatPrice(hoverData.price)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">Time</span>
                  <span className="text-[10px] font-black text-gray-400">{hoverData.time}</span>
                </div>
              </div>

              {hoverData.open !== undefined && (
                <div className="flex items-center gap-4 text-[10px] font-bold">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 uppercase">O</span>
                    <span className="text-white">{hoverData.open.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 uppercase">H</span>
                    <span className="text-green-400">{hoverData.high?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 uppercase">L</span>
                    <span className="text-red-400">{hoverData.low?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 uppercase">C</span>
                    <span className="text-white">{hoverData.close?.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/10 pl-4">
                    <span className="text-[7px] text-gray-500 uppercase leading-none">Vol</span>
                    <span className="text-white">{hoverData.volume?.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/10 pl-4">
                    <span className="text-[7px] text-gray-500 uppercase leading-none">OI</span>
                    <span className="text-white">{hoverData.openInterest?.toLocaleString()}</span>
                  </div>
                  {hoverData.ema20 !== undefined && (
                    <div className="flex flex-col border-l border-white/10 pl-4">
                      <span className="text-[7px] text-yellow-500 uppercase leading-none">EMA20</span>
                      <span className="text-yellow-100">{hoverData.ema20.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {selectedPoint && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 bg-blue-600/20 px-3 py-1 rounded-lg border border-blue-500/30 min-w-max"
            >
              <Target size={12} className="text-blue-400" />
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">Selected</span>
                <span className="text-[10px] font-black text-white tabular-nums">{formatPrice(selectedPoint.price)}</span>
              </div>
              <button 
                onClick={() => setSelectedPoint(null)}
                className="text-gray-500 hover:text-white"
              >
                <X size={10} />
              </button>
            </motion.div>
          )}
        </div>

        {currentPrice && (
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Live Price</span>
              <div className="flex items-center gap-2 relative">
                <motion.span
                  key={currentPrice}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  className={`text-sm font-black tabular-nums ${
                    priceDirection === 'up' ? 'text-green-400' : 
                    priceDirection === 'down' ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {formatPrice(currentPrice)}
                </motion.span>
                <AnimatePresence>
                  {priceDirection && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute -right-5"
                    >
                      {priceDirection === 'up' ? 
                        <TrendingUp size={14} className="text-green-400" /> : 
                        <TrendingDown size={14} className="text-red-400" />
                      }
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Glow Pulse */}
                <AnimatePresence mode="wait">
                  {priceDirection && (
                    <motion.div 
                      key={`${currentPrice}-glow`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 0.3, scale: 1.5 }}
                      exit={{ opacity: 0, scale: 2 }}
                      className={`absolute inset-0 blur-lg -z-10 rounded-full ${
                        priceDirection === 'up' ? 'bg-green-500/50' : 'bg-red-500/50'
                      }`}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 w-full relative flex">
        {/* Drawing Toolbar */}
        <div className="w-12 border-r border-white/5 flex flex-col items-center py-4 gap-4 bg-[#11141b]/30 z-20">
          <button 
            onClick={() => setActiveTool('none')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'none' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            title="Select tool"
          >
            <MousePointer2 size={18} />
          </button>
          <button 
            onClick={() => setActiveTool('line')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'line' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            title="Trend Line"
          >
            <Minus size={18} className="rotate-45" />
          </button>
          <button 
            onClick={() => setActiveTool('fib')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'fib' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            title="Fibonacci Retracement"
          >
            <Layers size={18} />
          </button>
          <button 
            onClick={() => setActiveTool('text')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'text' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            title="Text Annotation"
          >
            <Type size={18} />
          </button>
          <div className="flex-1" />
          <button 
            onClick={() => setDrawings([])}
            className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-all"
            title="Clear all drawings"
          >
            <Trash2 size={18} />
          </button>
          <button 
            onClick={exportChart}
            className="p-2 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-all"
            title="Export Chart as Image"
          >
            <Download size={18} />
          </button>
        </div>

        {/* Chart Area */}
        <div className="flex-1 relative overflow-hidden">
          {isDataLoading && (
            <div className="absolute inset-0 z-40 bg-[#0b0e14]/80 flex items-center justify-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <RefreshCw size={32} className="text-blue-500 animate-spin" />
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Aggregating Market Data...</span>
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
          {/* Drawing Canvas Overlay */}
          <canvas
            ref={overlayCanvasRef}
            className={`absolute inset-0 z-10 pointer-events-auto ${activeTool !== 'none' ? 'cursor-crosshair' : 'cursor-default pointer-events-none'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            width={dimensions.width}
            height={dimensions.height}
          />
        </div>
      </div>
    </div>
  );
};

const IconButton = ({ icon: Icon, badge, active, onClick }: { icon: LucideIcon, badge?: number | string | boolean, active?: boolean, onClick?: () => void }) => (
  <button onClick={onClick} className={`relative px-4 py-2 flex flex-col items-center justify-center transition-colors ${active ? 'text-white border-b-2 border-brand-purple' : 'text-gray-500'}`}>
    <Icon size={24} />
    {badge && (
      <span className="absolute top-1.5 right-3 w-4 h-4 bg-blue-500 text-[10px] text-white flex items-center justify-center rounded-full font-bold">
        {typeof badge === 'number' || typeof badge === 'string' ? badge : ''}
      </span>
    )}
  </button>
);

export default function App() {
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // UI State
  const [balance, setBalance] = useState(0);
  const [investment, setInvestment] = useState(2500);
  const [isPendingTrade, setIsPendingTrade] = useState(false);
  const [activeTab, setActiveTab] = useState('history');
  const [selectedAsset, setSelectedAsset] = useState(AVAILABLE_ASSETS[0]);
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [assetPrices, setAssetPrices] = useState<Record<string, number>>({});

  // Withdrawal States
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState<number>(2500);
  const [withdrawalMethod, setWithdrawalMethod] = useState<string>('UPI');
  const [withdrawalDetails, setWithdrawalDetails] = useState<string>('');
  const [withdrawalStatus, setWithdrawalStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

   // Alert States
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertTargetPrice, setAlertTargetPrice] = useState<number | string>('');
  const [alertType, setAlertType] = useState<'above' | 'below'>('above');
  const [activeNotification, setActiveNotification] = useState<any>(null);

  // Transaction States
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setBalance(data.user.balance);
          // Fetch alerts
          const alertsRes = await fetch('/api/alerts');
          if (alertsRes.ok) {
            const alertsData = await alertsRes.json();
            setAlerts(alertsData.alerts);
          }
          // Fetch transactions
          fetchTransactions();
        }
      } catch (err) {
        console.error("Auth check failed", err);
      } finally {
        setIsAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  // Global WebSocket for real-time updates with reconnection logic
  useEffect(() => {
    if (!user) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}`);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'balance_update') {
            setBalance(data.balance);
          } else if (data.type === 'alert_triggered') {
            setActiveNotification(data.alert);
            fetch('/api/alerts').then(res => res.json()).then(d => setAlerts(d.alerts));
            setTimeout(() => setActiveNotification(null), 10000);
          } else if (data.type === 'price_update') {
            const newPrices: Record<string, number> = {};
            data.assets.forEach((a: any) => {
              newPrices[a.id] = a.price;
            });
            setAssetPrices(prev => ({ ...prev, ...newPrices }));
          }
        } catch (err) {
          console.error("WebSocket message error", err);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected. Reconnecting...");
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error("WebSocket error", err);
        socket?.close();
      };
    };

    connect();

    return () => {
      if (socket) socket.close();
      clearTimeout(reconnectTimeout);
    };
  }, [user]);

  const handleAuthSuccess = (userData: any) => {
    setUser(userData);
    setBalance(userData.balance);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const handleWithdrawal = async () => {
    if (withdrawalAmount <= 0 || !withdrawalDetails) {
      return;
    }
    if (withdrawalAmount > balance) {
      return;
    }

    setWithdrawalStatus('loading');
    try {
      const response = await fetch('/api/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: withdrawalAmount,
          method: withdrawalMethod,
          details: withdrawalDetails,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setBalance(data.balance);
        setWithdrawalStatus('success');
        setTimeout(() => {
          setIsWithdrawing(false);
          setWithdrawalStatus('idle');
          setWithdrawalAmount(2500);
          setWithdrawalDetails('');
        }, 2000);
      } else {
        setWithdrawalStatus('error');
      }
    } catch (error) {
      setWithdrawalStatus('error');
    }
  };

  const handleCreateAlert = async () => {
    if (alertTargetPrice === '' || Number(alertTargetPrice) <= 0) return;

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          targetPrice: Number(alertTargetPrice),
          type: alertType
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts([...alerts, data.alert]);
        setIsAlertModalOpen(false);
        setAlertTargetPrice('');
      }
    } catch (error) {
      console.error("Failed to create alert", error);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}`, { method: 'DELETE' });
      if (response.ok) {
        setAlerts(alerts.filter(a => a.id !== alertId));
      }
    } catch (error) {
      console.error("Failed to delete alert", error);
    }
  };

  const fetchTransactions = async () => {
    setIsTransactionsLoading(true);
    try {
      const response = await fetch('/api/transactions');
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error("Failed to fetch transactions", error);
    } finally {
      setIsTransactionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'profile' && user) {
      fetchTransactions();
    }
  }, [activeTab, user]);
  
  // Trade Confirmation State
  const [confirmingTrade, setConfirmingTrade] = useState<{ type: 'buy' | 'sell', asset: string, amount: number } | null>(null);
  const [executingTrade, setExecutingTrade] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<'idle' | 'executing' | 'confirmed' | 'failed'>('idle');
  const [tradeCountdown, setTradeCountdown] = useState(10);
  const [lastTradeResult, setLastTradeResult] = useState<{ status: 'win' | 'loss', profit: number, asset: string } | null>(null);

  // Countdown timer for trade confirmation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (confirmingTrade && tradeStatus === 'idle') {
      if (tradeCountdown > 0) {
        timer = setTimeout(() => setTradeCountdown(prev => prev - 1), 1000);
      } else {
        setConfirmingTrade(null);
        setTradeCountdown(10);
      }
    }
    return () => clearTimeout(timer);
  }, [confirmingTrade, tradeCountdown, tradeStatus]);

  // Reset countdown when a new trade is initiated
  useEffect(() => {
    if (confirmingTrade) {
      setTradeCountdown(10);
      setTradeStatus('idle');
    }
  }, [confirmingTrade]);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleExecuteTrade = async () => {
    if (!confirmingTrade) return;
    setExecutingTrade(true);
    setTradeStatus('executing');

    try {
      // Simulate a delay for "Executing..." state
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Simulate a "win" for now or random outcome
      const outcome = Math.random() > 0.4 ? 'win' : 'loss';
      
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: confirmingTrade.asset,
          type: confirmingTrade.type,
          amount: confirmingTrade.amount,
          status: outcome
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
        setTradeStatus('confirmed');
        
        // Wait a bit to show "Confirmed" state before closing the modal
        await new Promise(resolve => setTimeout(resolve, 1200));

        setLastTradeResult({
          status: outcome,
          profit: data.trade.profit,
          asset: confirmingTrade.asset
        });
        setConfirmingTrade(null);
        setTradeStatus('idle');
        
        // Notify chart to refresh markers
        window.dispatchEvent(new CustomEvent('trade-executed'));
        
        // Auto-close result after 4 seconds
        setTimeout(() => setLastTradeResult(null), 4000);
      } else {
        setTradeStatus('failed');
        const error = await response.json();
        // Keep "failed" state visible for a bit
        setTimeout(() => {
          setConfirmingTrade(null);
          setTradeStatus('idle');
        }, 2000);
      }
    } catch (err) {
      console.error('Trade execution error', err);
      setTradeStatus('failed');
      setTimeout(() => {
        setConfirmingTrade(null);
        setTradeStatus('idle');
      }, 2000);
    } finally {
      setExecutingTrade(false);
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-purple/20 border-t-brand-purple rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="bg-slate-950 flex items-center justify-center min-h-screen p-0 md:p-4">
      {/* Mobile Frame */}
      <div 
        ref={containerRef}
        className="relative bg-slate-950 w-full max-w-[390px] h-screen max-h-[844px] shadow-2xl overflow-hidden flex flex-col font-sans border-x border-slate-900"
      >
        
        {/* 1. TOP HEADER */}
        <header className="h-[60px] flex items-center justify-between px-3 bg-[#0b0e14] border-b border-[#1a1f26] shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#1c222d] border border-[#2d3340] rounded-md px-2 py-1 shadow-inner cursor-pointer hover:bg-[#232a38] transition-colors">
              <div className="flex items-center gap-1.5 border-r border-gray-700 pr-2 mr-2">
                <TrendingUp size={14} className="text-green-500" />
                <span className="text-[10px] font-black text-green-500 tracking-tight">LIVE</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white font-bold text-[13px]">{formatCurrency(balance).replace('₹', '₹ ')}</span>
                <ChevronDown size={14} className="text-gray-500" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="relative cursor-pointer">
               <Bell size={20} className="text-gray-400" />
               <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#f84a4a] text-[10px] text-white flex items-center justify-center rounded-full font-bold border border-[#0b0e14]">2</span>
             </div>
             
             <button className="bg-[#00c580] text-white px-5 py-2.5 rounded-lg text-xs font-black hover:bg-[#00d68b] transition-colors shadow-lg shadow-green-900/10">
               Deposit
             </button>
          </div>
        </header>

        {/* 2. MAIN CONTENT AREA */}
        {activeTab === 'chart' ? (
          <>
            <div className="relative flex-1 bg-[#0b0e14] flex flex-col min-h-0 overflow-hidden">
              <TradingViewChart 
                symbol={selectedAsset.id} 
                currentPrice={assetPrices[selectedAsset.id]} 
              />

              {/* 3. SIDE BUTTONS (QUOTEX STYLE) */}
              <div className="absolute top-1/2 -translate-y-1/2 left-2 flex flex-col gap-2 z-10">
                 <button className="w-10 h-10 rounded-xl bg-[#1c222d]/90 backdrop-blur-sm flex items-center justify-center border border-white/5 shadow-2xl text-gray-300">
                   <Menu size={20} />
                 </button>
                 <button className="w-10 h-10 rounded-xl bg-[#1c222d]/90 backdrop-blur-sm flex items-center justify-center border border-white/5 shadow-2xl text-gray-300 relative">
                   <Briefcase size={20} />
                   <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-[#4589ff] rounded-full text-[10px] flex items-center justify-center font-bold text-white border-2 border-[#0b0e14]">0</span>
                 </button>
              </div>

              {/* Chart Labels Overlay */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
                 <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[11px] font-bold text-white/90">15:22:24</span>
                    <span className="text-[9px] text-white/40 font-medium">UTC</span>
                 </div>
              </div>
            </div>

            {/* 4. TRADE PANEL */}
            <div className="bg-[#0b0e14] px-3 pt-3 pb-2 border-t border-[#1a1f26] shrink-0 select-none relative">
              {/* Asset Selector Dropdown */}
              <AnimatePresence>
                {isAssetSelectorOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-3 right-3 mb-2 bg-[#1c222d] border border-[#2d3340] rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-3 border-b border-white/5 bg-white/5">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Select Instrument</span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      {AVAILABLE_ASSETS.map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() => {
                            setSelectedAsset(asset);
                            setIsAssetSelectorOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors ${selectedAsset.id === asset.id ? 'bg-brand-purple/10 border-l-2 border-brand-purple' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center font-bold text-xs border border-white/5">
                              {asset.symbol}
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-bold text-gray-100">{asset.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                             <div className="text-sm font-black text-green-500">{asset.payout}%</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Pair Selection Row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div 
                    onClick={() => setIsAssetSelectorOpen(!isAssetSelectorOpen)}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                      <span className="text-[10px] font-black text-gray-200">{selectedAsset.symbol}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-black text-gray-100 uppercase tracking-tight group-hover:text-white transition-colors">
                      {selectedAsset.name} 
                      <span className="text-[#f1a43a] text-sm">{selectedAsset.payout}%</span>
                      {assetPrices[selectedAsset.id] && (
                        <span className="text-gray-400 text-[10px] ml-1 font-mono">
                          {assetPrices[selectedAsset.id].toFixed(selectedAsset.id.includes('BTC') || selectedAsset.id.includes('ETH') ? 2 : 5)}
                        </span>
                      )}
                      <ChevronDown size={16} className={`text-gray-500 transition-transform ${isAssetSelectorOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setAlertTargetPrice(assetPrices[selectedAsset.id] || 0);
                      setIsAlertModalOpen(true);
                    }}
                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-blue-600/20 hover:text-blue-400 transition-all text-gray-500 ml-1"
                    title="Set Price Alert"
                  >
                    <Bell size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black text-[#5e7ca3] uppercase tracking-widest">Pending Trade</span>
                   <button 
                     onClick={() => setIsPendingTrade(!isPendingTrade)}
                     className={`w-9 h-[22px] rounded-full relative transition-colors p-0.5 ${isPendingTrade ? 'bg-[#1a73e8]' : 'bg-[#212732]'}`}
                   >
                     <motion.div 
                       animate={{ x: isPendingTrade ? 16 : 0 }}
                       className="w-4 h-4 bg-white rounded-full shadow-sm"
                     />
                   </button>
                </div>
              </div>

              {/* Inputs Grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="bg-[#1c222d] border border-[#2d3340] rounded-xl p-3 relative h-[60px] flex flex-col justify-center">
                   <div className="text-[10px] font-black text-gray-500 absolute top-2 left-3 uppercase tracking-wider">Time</div>
                   <div className="text-base font-black text-white mt-2">15:23</div>
                </div>
                
                <div className="bg-[#1c222d] border border-[#2d3340] rounded-xl p-3 relative h-[60px] shadow-lg shadow-black/20">
                   <div className="text-[10px] font-black text-gray-500 absolute top-2 left-3 uppercase tracking-wider">Investment</div>
                   <div className="flex items-center justify-between mt-3 px-1">
                      <button onClick={() => setInvestment(Math.max(50, investment - 50))} className="text-gray-400 hover:text-white"><Minus size={18} /></button>
                      <div className="text-base font-black text-white">{investment} ₹</div>
                      <button onClick={() => setInvestment(investment + 50)} className="text-gray-400 hover:text-white"><Plus size={18} /></button>
                   </div>
                   <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[#1c222d] border border-[#2d3340] px-3 py-0.5 rounded text-[9px] font-black text-blue-500 uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors">Switch</div>
                </div>
              </div>

              <div className="flex items-center justify-between px-1 mb-2">
                 <span className="text-[11px] font-bold text-gray-500">Payout</span>
                 <span className="text-[14px] font-black text-white">{Math.floor(investment * (1 + selectedAsset.payout / 100))} ₹</span>
              </div>

              {/* Buy/Sell Buttons */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <motion.button 
                   whileTap={{ scale: 0.96 }}
                   onClick={() => setConfirmingTrade({ type: 'buy', asset: selectedAsset.name, amount: investment })}
                   className="h-[60px] bg-[#00c580] rounded-xl relative flex items-center px-4 shadow-lg shadow-green-900/20 active:bg-green-500 transition-colors"
                >
                  <div className="text-left flex-1">
                    <div className="text-base font-black text-white leading-none">Buy</div>
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center">
                    <TrendingUp size={20} className="text-white" />
                  </div>
                </motion.button>
                <motion.button 
                   whileTap={{ scale: 0.96 }}
                   onClick={() => setConfirmingTrade({ type: 'sell', asset: selectedAsset.name, amount: investment })}
                   className="h-[60px] bg-[#f84a4a] rounded-xl relative flex items-center px-4 shadow-lg shadow-red-900/20 active:bg-red-500 transition-colors"
                >
                  <div className="text-left flex-1">
                    <div className="text-base font-black text-white leading-none">Sell</div>
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center">
                    <TrendingDown size={20} className="text-white" />
                  </div>
                </motion.button>
              </div>
            </div>

            {/* Confirmation Modal */}
            <AnimatePresence>
              {confirmingTrade && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => !executingTrade && setConfirmingTrade(null)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-sm glass-card p-6 overflow-hidden border border-white/10"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/10 blur-3xl -z-10" />
                    
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-black text-white flex items-center gap-2">
                         {tradeStatus === 'idle' && <ShieldCheck className="text-blue-500" size={24} />}
                         {tradeStatus === 'executing' && <RefreshCw className="text-blue-500 animate-spin" size={24} />}
                         {tradeStatus === 'confirmed' && <CheckCircle2 className="text-green-500" size={24} />}
                         {tradeStatus === 'failed' && <AlertCircle className="text-red-500" size={24} />}
                         
                         {tradeStatus === 'idle' && 'Confirm Trade'}
                         {tradeStatus === 'executing' && 'Executing...'}
                         {tradeStatus === 'confirmed' && 'Trade Confirmed!'}
                         {tradeStatus === 'failed' && 'Trade Failed'}
                      </h3>
                      {tradeStatus === 'idle' && (
                        <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                           <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Expires in</span>
                           <span className={`text-xs font-black tabular-nums ${tradeCountdown <= 3 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
                             {tradeCountdown}s
                           </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 mb-6 relative">
                      {/* Progress Bar for Countdown */}
                      {tradeStatus === 'idle' && (
                        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-white/5 overflow-hidden rounded-full">
                          <motion.div 
                            initial={{ width: '100%' }}
                            animate={{ width: `${(tradeCountdown / 10) * 100}%` }}
                            transition={{ duration: 1, ease: "linear" }}
                            className={`h-full ${tradeCountdown <= 3 ? 'bg-red-500' : 'bg-blue-500'}`}
                          />
                        </div>
                      )}

                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Asset</span>
                        <span className="text-sm font-black text-white">{confirmingTrade.asset}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Direction</span>
                        <span className={`text-sm font-black uppercase flex items-center gap-1 ${confirmingTrade.type === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                          {confirmingTrade.type === 'buy' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {confirmingTrade.type === 'buy' ? 'BUY (Call)' : 'SELL (Put)'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Investment</span>
                        <span className="text-sm font-black text-white">{formatCurrency(confirmingTrade.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Payout</span>
                        <span className="text-sm font-black text-white">91%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        disabled={executingTrade}
                        onClick={() => setConfirmingTrade(null)}
                        className="py-4 rounded-xl border border-white/10 text-gray-500 font-black text-xs uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all disabled:opacity-0"
                      >
                        Cancel
                      </button>
                      <button 
                        disabled={executingTrade || tradeStatus !== 'idle'}
                        onClick={handleExecuteTrade}
                        className={`py-4 rounded-xl font-black text-xs uppercase tracking-widest relative overflow-hidden transition-all active:scale-95 disabled:opacity-50 ${
                          tradeStatus === 'confirmed' 
                            ? 'bg-green-600 text-white' 
                            : tradeStatus === 'failed'
                              ? 'bg-red-600 text-white'
                              : 'bg-blue-600 text-white hover:bg-blue-500 shadow-xl shadow-blue-900/20'
                        }`}
                      >
                        <span className="relative z-10">
                          {tradeStatus === 'idle' && 'Place Order'}
                          {tradeStatus === 'executing' && 'Executing...'}
                          {tradeStatus === 'confirmed' && 'Confirmed'}
                          {tradeStatus === 'failed' && 'Failed'}
                        </span>
                        
                        {tradeStatus === 'executing' && (
                          <motion.div 
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="absolute inset-0 bg-white/20 skew-x-12"
                          />
                        )}
                      </button>
                    </div>

                    {tradeStatus === 'executing' && (
                       <p className="text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-4 animate-pulse">
                         Connecting to pool and verifying liquidity...
                       </p>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Trade Result Overlay */}
            <AnimatePresence>
              {lastTradeResult && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-none">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: -50 }}
                    className={`relative w-full max-w-[280px] rounded-3xl p-6 overflow-hidden shadow-2xl backdrop-blur-xl border ${
                      lastTradeResult.status === 'win' 
                        ? 'bg-green-500/20 border-green-500/30 shadow-green-500/20' 
                        : 'bg-red-500/20 border-red-500/30 shadow-red-500/20'
                    }`}
                  >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-white/20">
                       <motion.div 
                         initial={{ width: "100%" }}
                         animate={{ width: "0%" }}
                         transition={{ duration: 4, ease: "linear" }}
                         className="h-full bg-white/40"
                       />
                    </div>

                    <div className="flex flex-col items-center text-center">
                      <motion.div 
                        initial={{ rotate: -10, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", damping: 8 }}
                        className={`w-16 h-16 rounded-2xl mb-4 flex items-center justify-center ${
                          lastTradeResult.status === 'win' ? 'bg-green-500 shadow-lg shadow-green-500/40' : 'bg-red-500 shadow-lg shadow-red-500/40'
                        }`}
                      >
                        {lastTradeResult.status === 'win' ? (
                          <Trophy className="text-white" size={32} />
                        ) : (
                          <Frown className="text-white" size={32} />
                        )}
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        <div className="text-[10px] font-bold text-white/60 mb-1 uppercase tracking-widest">
                          {lastTradeResult.asset}
                        </div>
                        <h4 className="text-2xl font-black text-white mb-1">
                          {lastTradeResult.status === 'win' ? 'YOU WON!' : 'TRADE LOST'}
                        </h4>
                        <div className={`text-3xl font-black ${
                          lastTradeResult.status === 'win' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {lastTradeResult.status === 'win' ? '+' : ''}
                          {formatCurrency(lastTradeResult.profit)}
                        </div>
                      </motion.div>

                      {lastTradeResult.status === 'win' && (
                        <motion.div 
                          className="absolute inset-0 pointer-events-none"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          {[...Array(6)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="absolute"
                              initial={{ 
                                x: "50%", 
                                y: "50%", 
                                scale: 0,
                                opacity: 1 
                              }}
                              animate={{ 
                                x: `${Math.random() * 100}%`, 
                                y: `${Math.random() * 100}%`, 
                                scale: [0, 1, 0],
                                opacity: 0
                              }}
                              transition={{ 
                                duration: 1 + Math.random(), 
                                repeat: Infinity,
                                repeatDelay: Math.random() 
                              }}
                            >
                              <Sparkles className="text-yellow-400/50" size={12} />
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </>
        ) : activeTab === 'history' ? (
          <TradeHistory />
        ) : (
          <>
            <Profile 
              user={user}
              balance={balance}
              transactions={transactions}
              isTransactionsLoading={isTransactionsLoading}
              onRefreshTransactions={fetchTransactions}
              onLogout={handleLogout}
              onWithdraw={() => setIsWithdrawing(true)}
              onDeposit={() => alert('Deposit feature coming soon!')}
              alerts={alerts}
              onDeleteAlert={handleDeleteAlert}
              formatCurrency={formatCurrency}
            />

            {/* Alert Notification */}
            <AnimatePresence>
               {activeNotification && (
                 <motion.div 
                    initial={{ opacity: 0, y: -100, x: '-50%' }}
                    animate={{ opacity: 1, y: 20, x: '-50%' }}
                    exit={{ opacity: 0, y: -100, x: '-50%' }}
                    className="fixed top-0 left-1/2 z-[150] w-full max-w-sm px-4"
                 >
                    <div className="bg-[#1c222d] border-2 border-blue-500 rounded-2xl p-4 shadow-2xl flex items-center gap-4 relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1 bg-blue-500 h-full" />
                       <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                          <Bell size={24} className="text-blue-500 animate-bounce" />
                       </div>
                       <div className="flex-1">
                          <h5 className="text-sm font-black text-white leading-tight">Price Alert!</h5>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                             {activeNotification.assetId.split(':')[1] || activeNotification.assetId} reached {formatCurrency(activeNotification.targetPrice)}
                          </p>
                       </div>
                       <button 
                        onClick={() => setActiveNotification(null)}
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                       >
                         <X size={16} />
                       </button>
                    </div>
                 </motion.div>
               )}
            </AnimatePresence>

            {/* Create Alert Modal */}
            <AnimatePresence>
               {isAlertModalOpen && (
                 <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                 >
                    <motion.div 
                       initial={{ scale: 0.9, opacity: 0, y: 20 }}
                       animate={{ scale: 1, opacity: 1, y: 0 }}
                       exit={{ scale: 0.9, opacity: 0, y: 20 }}
                       className="w-full max-w-sm bg-[#161a22] border border-[#2d3340] rounded-3xl p-6 shadow-2xl relative overflow-hidden"
                    >
                       <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl -z-10" />
                       
                       <div className="flex items-center justify-between mb-6">
                          <h4 className="text-xl font-black text-white">Create Price Alert</h4>
                          <button 
                             onClick={() => setIsAlertModalOpen(false)}
                             className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                          >
                             <X size={20} />
                          </button>
                       </div>

                       <div className="space-y-6">
                          <div>
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Alert Type</label>
                             <div className="grid grid-cols-2 gap-3">
                                <button 
                                   onClick={() => setAlertType('above')}
                                   className={`py-3 rounded-xl border font-black text-xs transition-all ${
                                      alertType === 'above' ? 'bg-green-600/10 border-green-600/50 text-green-500' : 'bg-white/5 border-white/5 text-gray-500'
                                   }`}
                                >
                                   Price goes above
                                </button>
                                <button 
                                   onClick={() => setAlertType('below')}
                                   className={`py-3 rounded-xl border font-black text-xs transition-all ${
                                      alertType === 'below' ? 'bg-red-600/10 border-red-600/50 text-red-500' : 'bg-white/5 border-white/5 text-gray-500'
                                   }`}
                                >
                                   Price goes below
                                </button>
                             </div>
                          </div>

                          <div>
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Target Price</label>
                             <div className="bg-[#1c222d] border border-[#2d3340] rounded-xl p-4 flex items-center gap-3 shadow-inner focus-within:border-blue-500 transition-colors">
                                <div className="text-gray-500 font-bold">₹</div>
                                <input 
                                   type="number"
                                   value={alertTargetPrice}
                                   onChange={(e) => setAlertTargetPrice(e.target.value)}
                                   className="bg-transparent border-none outline-none text-white font-black text-lg w-full"
                                   placeholder="0.00"
                                   step="0.0001"
                                />
                             </div>
                             <p className="text-center text-[10px] text-gray-500 mt-2 font-bold uppercase tracking-widest leading-tight">
                                Current Price: <span className="text-blue-400">{formatCurrency(assetPrices[selectedAsset.id] || 0)}</span>
                             </p>
                          </div>

                          <button 
                             onClick={handleCreateAlert}
                             className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
                          >
                             Create Alert
                          </button>
                       </div>
                    </motion.div>
                 </motion.div>
               )}
            </AnimatePresence>

            {/* Withdrawal Modal */}
            <AnimatePresence>
               {isWithdrawing && (
                 <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
                 >
                    <motion.div 
                       initial={{ y: "100%" }}
                       animate={{ y: 0 }}
                       exit={{ y: "100%" }}
                       transition={{ type: "spring", damping: 25, stiffness: 300 }}
                       className="w-full max-w-md bg-[#161a22] border-t sm:border border-[#2d3340] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative"
                    >
                       <div className="flex items-center justify-between mb-6">
                          <h4 className="text-xl font-black text-white">Withdraw Funds</h4>
                          <button 
                             onClick={() => setIsWithdrawing(false)}
                             className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                          >
                             <X size={20} />
                          </button>
                       </div>

                       {withdrawalStatus === 'success' ? (
                          <div className="py-8 flex flex-col items-center text-center">
                             <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                                <CheckCircle2 className="text-green-500" size={48} />
                             </div>
                             <h5 className="text-xl font-black text-white mb-2">Request Submitted!</h5>
                             <p className="text-gray-400 text-sm mb-6">Your withdrawal of {formatCurrency(withdrawalAmount)} is being processed.</p>
                             <div className="w-full p-4 bg-white/5 rounded-xl border border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-left">
                                Ref ID: {Math.random().toString(36).substring(7).toUpperCase()}
                             </div>
                          </div>
                       ) : (
                          <div className="space-y-5">
                             <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Amount to Withdraw</label>
                                <div className="bg-[#1c222d] border border-[#2d3340] rounded-xl p-4 flex items-center justify-between shadow-inner focus-within:border-blue-500 transition-colors">
                                   <input 
                                     type="number" 
                                     value={withdrawalAmount}
                                     onChange={(e) => setWithdrawalAmount(Number(e.target.value))}
                                     className="bg-transparent border-none outline-none text-white font-black text-lg w-full"
                                     placeholder="0.00"
                                   />
                                   <span className="text-gray-500 font-black text-sm ml-2">₹</span>
                                </div>
                                <div className="flex gap-2 mt-2">
                                   {[500, 1000, 2500, 5000].map(amt => (
                                      <button 
                                        key={amt}
                                        onClick={() => setWithdrawalAmount(amt)}
                                        className="flex-1 py-2 bg-white/5 rounded-lg text-[10px] font-black text-gray-400 hover:text-white hover:bg-white/10 border border-white/5 transition-all"
                                      >
                                         {amt}
                                      </button>
                                   ))}
                                </div>
                             </div>

                             <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Payment Method</label>
                                <div className="grid grid-cols-2 gap-3">
                                   <button 
                                      onClick={() => setWithdrawalMethod('UPI')}
                                      className={`p-4 rounded-xl border transition-all text-left relative overflow-hidden group ${
                                        withdrawalMethod === 'UPI' ? 'bg-blue-600/10 border-blue-600/50' : 'bg-white/5 border-white/5 hover:border-white/20'
                                      }`}
                                   >
                                      <div className={`text-xs font-black ${withdrawalMethod === 'UPI' ? 'text-blue-400' : 'text-gray-400'}`}>UPI</div>
                                      <div className="text-[10px] text-gray-500 font-bold mt-1">Instant</div>
                                      {withdrawalMethod === 'UPI' && <CheckCircle2 size={14} className="absolute top-2 right-2 text-blue-500" />}
                                   </button>
                                   <button 
                                      onClick={() => setWithdrawalMethod('Bank')}
                                      className={`p-4 rounded-xl border transition-all text-left relative overflow-hidden group ${
                                        withdrawalMethod === 'Bank' ? 'bg-blue-600/10 border-blue-600/50' : 'bg-white/5 border-white/5 hover:border-white/20'
                                      }`}
                                   >
                                      <div className={`text-xs font-black ${withdrawalMethod === 'Bank' ? 'text-blue-400' : 'text-gray-400'}`}>Bank</div>
                                      <div className="text-[10px] text-gray-500 font-bold mt-1">2-24h</div>
                                      {withdrawalMethod === 'Bank' && <CheckCircle2 size={14} className="absolute top-2 right-2 text-blue-500" />}
                                   </button>
                                </div>
                             </div>

                             <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">
                                   {withdrawalMethod === 'UPI' ? 'UPI ID' : 'Bank Details (Acc/IFSC)'}
                                </label>
                                <div className="bg-[#1c222d] border border-[#2d3340] rounded-xl p-4 flex items-center shadow-inner focus-within:border-blue-500 transition-colors">
                                   <CreditCard size={18} className="text-gray-500 mr-3" />
                                   <input 
                                     type="text" 
                                     value={withdrawalDetails}
                                     onChange={(e) => setWithdrawalDetails(e.target.value)}
                                     className="bg-transparent border-none outline-none text-white font-bold text-sm w-full"
                                     placeholder={withdrawalMethod === 'UPI' ? "example@upi" : "Acc: ... / IFSC: ..."}
                                   />
                                </div>
                             </div>

                             <div className="pt-2">
                                <button 
                                   onClick={handleWithdrawal}
                                   disabled={withdrawalStatus === 'loading' || !withdrawalDetails || withdrawalAmount <= 0 || withdrawalAmount > balance}
                                   className={`w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-3 transition-all ${
                                     withdrawalStatus === 'loading' 
                                       ? 'bg-blue-600/50 cursor-wait' 
                                       : (!withdrawalDetails || withdrawalAmount <= 0 || withdrawalAmount > balance)
                                          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/20 active:scale-[0.98]'
                                   }`}
                                >
                                   {withdrawalStatus === 'loading' ? (
                                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                   ) : (
                                      <>
                                         Confirm Withdrawal
                                         <ArrowRight size={18} />
                                      </>
                                   )}
                                </button>
                                {withdrawalAmount > balance && (
                                   <p className="text-center text-red-400 text-[10px] font-bold mt-2 uppercase tracking-widest animate-pulse">Insufficient Balance</p>
                                )}
                             </div>
                             
                             <div className="flex items-center justify-center gap-2 text-[10px] text-gray-600 font-bold uppercase tracking-widest pb-2">
                                <ShieldCheck size={12} />
                                Secure SSL Encrypted
                             </div>
                          </div>
                       )}
                    </motion.div>
                 </motion.div>
               )}
            </AnimatePresence>
          </>
        )}

        {/* 8. BOTTOM NAVIGATION */}
        <nav className="h-[64px] bg-[#0b0e14] flex items-center justify-around border-t border-[#1a1f26] shrink-0">
          <IconButton icon={Briefcase} active={activeTab === 'chart'} onClick={() => setActiveTab('chart')} />
          <IconButton icon={History} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <IconButton 
            icon={User} 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
            badge={alerts.filter(a => a.status === 'active').length > 0 ? alerts.filter(a => a.status === 'active').length : undefined}
          />
          <IconButton icon={Trophy} badge={3} />
          <IconButton icon={Menu} badge={4} />
        </nav>

        {/* Device Indicators (Notch replacement) */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/20 rounded-full" />
      </div>
    </div>
  );
}

