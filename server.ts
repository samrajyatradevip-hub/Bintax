import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer } from "ws";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "database.json");
const SECRET = process.env.JWT_SECRET || "default_secret_key";

// Initialize dummy DB if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ 
    users: [],
    trades: [], // Initialize trades collection
    withdrawals: [], // Initialize withdrawals collection
    alerts: [], // Initialize alerts collection
    deposits: [] // Initialize deposits collection
  }));
}

function getDB() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  if (!db.users) db.users = [];
  if (!db.trades) db.trades = [];
  if (!db.withdrawals) db.withdrawals = [];
  if (!db.alerts) db.alerts = [];
  if (!db.deposits) db.deposits = [];
  return db;
}

function saveDB(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Helper to ensure dummy data exists for a user if they just registered or for demo purposes
function seedTrades(userId: string) {
  const db = getDB();
  const userTrades = db.trades.filter((t: any) => t.userId === userId);
  if (userTrades.length === 0) {
    const mockTrades = [
      { id: '1', userId, asset: 'BTC/INR', type: 'buy', amount: 2500, status: 'win', profit: 2150, time: Date.now() - 3600000 },
      { id: '2', userId, asset: 'ETH/INR', type: 'sell', amount: 1200, status: 'loss', profit: -1200, time: Date.now() - 7200000 },
      { id: '3', userId, asset: 'USDT/INR', type: 'buy', amount: 5000, status: 'win', profit: 4250, time: Date.now() - 86400000 },
    ];
    db.trades.push(...mockTrades);
    saveDB(db);
  }
}

async function startServer() {
  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  app.post("/api/auth/register", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const db = getDB();
    if (db.users.find((u: any) => u.email === email)) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      balance: 10000, // Starting balance for new users
    };

    db.users.push(newUser);
    saveDB(db);
    seedTrades(newUser.id); // Seed some trades for UI

    const token = jwt.sign({ userId: newUser.id }, SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ user: { id: newUser.id, email: newUser.email, balance: newUser.balance } });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    const user = db.users.find((u: any) => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    seedTrades(user.id); // Ensure demo trades exist

    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ user: { id: user.id, email: user.email, balance: user.balance } });
  });

  app.get("/api/auth/me", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded: any = jwt.verify(token, SECRET);
      const db = getDB();
      const user = db.users.find((u: any) => u.id === decoded.userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      res.json({ user: { id: user.id, email: user.email, balance: user.balance } });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.get("/api/trades", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded: any = jwt.verify(token, SECRET);
      const db = getDB();
      const trades = db.trades || [];
      const userTrades = trades.filter((t: any) => t.userId === decoded.userId);
      res.json({ trades: userTrades.sort((a: any, b: any) => b.time - a.time) });
    } catch (e: any) {
      if (e.name === "JsonWebTokenError") {
        res.status(401).json({ error: "Invalid token" });
      } else {
        console.error("Trades API error:", e);
        res.status(500).json({ error: "Internal server error", message: e.message });
      }
    }
  });

  app.post("/api/trades", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded: any = jwt.verify(token, SECRET);
      const { asset, type, amount, status } = req.body;

      if (!asset || !type || !amount) {
        return res.status(400).json({ error: "Missing trade details" });
      }

      const db = getDB();
      const user = db.users.find((u: any) => u.id === decoded.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.balance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Simple profit calculation (91% payout as shown in UI)
      const payoutMultiplier = 0.91;
      const profit = status === 'win' ? Math.round(amount * payoutMultiplier) : -amount;

      const newTrade = {
        id: Date.now().toString(),
        userId: user.id,
        asset,
        type,
        amount,
        status: status || 'pending',
        profit,
        time: Date.now()
      };

      // Update user balance
      user.balance += profit;
      db.trades.push(newTrade);
      saveDB(db);

      // Broadcast balance update via WS
      const balanceUpdateData = JSON.stringify({
        type: 'balance_update',
        balance: user.balance
      });
      userClients.get(user.id)?.forEach(client => {
        if (client.readyState === 1) client.send(balanceUpdateData);
      });

      res.json({ trade: newTrade, balance: user.balance });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/withdraw", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded: any = jwt.verify(token, SECRET);
      const { amount, method, details } = req.body;

      if (!amount || !method || !details) {
        return res.status(400).json({ error: "Missing withdrawal details" });
      }

      const db = getDB();
      const user = db.users.find((u: any) => u.id === decoded.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.balance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      const newWithdrawal = {
        id: Date.now().toString(),
        userId: user.id,
        amount,
        method,
        details,
        status: "pending",
        time: Date.now()
      };

      // Deduct balance immediately
      user.balance -= amount;
      db.withdrawals.push(newWithdrawal);
      saveDB(db);

      // Broadcast balance update via WS
      const balanceUpdateData = JSON.stringify({
        type: 'balance_update',
        balance: user.balance
      });
      userClients.get(user.id)?.forEach(client => {
        if (client.readyState === 1) client.send(balanceUpdateData);
      });

      res.json({ withdrawal: newWithdrawal, balance: user.balance });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });
  
  app.get("/api/alerts", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded: any = jwt.verify(token, SECRET);
      const db = getDB();
      const userAlerts = db.alerts.filter((a: any) => a.userId === decoded.userId);
      res.json({ alerts: userAlerts });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/alerts", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded: any = jwt.verify(token, SECRET);
      const { assetId, targetPrice, type } = req.body;
      if (!assetId || targetPrice === undefined || !type) {
        return res.status(400).json({ error: "Missing alert details" });
      }
      
      const db = getDB();
      const newAlert = {
        id: Date.now().toString(),
        userId: decoded.userId,
        assetId,
        targetPrice,
        type, // 'above' or 'below'
        status: 'active',
        createdAt: Date.now()
      };
      db.alerts.push(newAlert);
      saveDB(db);
      res.json({ alert: newAlert });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.delete("/api/alerts/:id", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded: any = jwt.verify(token, SECRET);
      const db = getDB();
      db.alerts = db.alerts.filter((a: any) => !(a.id === req.params.id && a.userId === decoded.userId));
      saveDB(db);
      res.json({ success: true });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.get("/api/transactions", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded: any = jwt.verify(token, SECRET);
      const db = getDB();
      
      const withdrawals = db.withdrawals.filter((w: any) => w.userId === decoded.userId).map((w: any) => ({
        ...w,
        type: 'withdrawal',
      }));
      
      const deposits = db.deposits.filter((d: any) => d.userId === decoded.userId).map((d: any) => ({
        ...d,
        type: 'deposit',
      }));

      // Add a mock deposit if none exist to show UI works
      if (deposits.length === 0) {
        deposits.push({
          id: 'mock-1',
          userId: decoded.userId,
          amount: 10000,
          method: 'Welcome Bonus',
          status: 'completed',
          time: Date.now() - 86400000 * 2,
          type: 'deposit'
        });
      }

      const allTransactions = [...withdrawals, ...deposits].sort((a: any, b: any) => b.time - a.time);
      res.json({ transactions: allTransactions });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  // WebSocket logic
  const wss = new WebSocketServer({ server });
  const userClients = new Map<string, Set<any>>();

  wss.on('connection', (ws, req) => {
    // Basic cookie parsing to identify user
    const cookies = req.headers.cookie?.split(';').reduce((acc: any, cur: string) => {
      const parts = cur.trim().split('=');
      if (parts.length === 2) {
        acc[parts[0]] = parts[1];
      }
      return acc;
    }, {});

    const token = cookies?.token;
    let userId: string | null = null;

    if (token) {
      try {
        const decoded: any = jwt.verify(token, SECRET);
        userId = decoded.userId;
        if (userId) {
          if (!userClients.has(userId)) userClients.set(userId, new Set());
          userClients.get(userId)?.add(ws);
        }
      } catch (e) {
        // Invalid token
      }
    }

    ws.on('close', () => {
      if (userId && userClients.has(userId)) {
        userClients.get(userId)?.delete(ws);
        if (userClients.get(userId)?.size === 0) userClients.delete(userId);
      }
    });
  });

  const assets = [
    { id: 'FX:EURUSD', price: 1.0850, volatility: 0.0004 },
    { id: 'FX:GBPUSD', price: 1.2540, volatility: 0.0004 },
    { id: 'FX:USDJPY', price: 155.20, volatility: 0.05 },
    { id: 'BINANCE:BTCUSDT', price: 64000, volatility: 50 },
    { id: 'BINANCE:ETHUSDT', price: 3100, volatility: 5 },
    { id: 'OANDA:XAUUSD', price: 2350.20, volatility: 0.5 },
  ];

  setInterval(() => {
    const updates = assets.map(a => {
      const change = (Math.random() - 0.5) * a.volatility;
      a.price = +(a.price + change).toPrecision(7);
      return { id: a.id, price: a.price };
    });

    // Check alerts
    const db = getDB();
    let dbChanged = false;
    db.alerts.forEach((alert: any) => {
      if (alert.status !== 'active') return;
      
      const asset = assets.find(a => a.id === alert.assetId);
      if (!asset) return;

      const isTriggered = alert.type === 'above' 
        ? asset.price >= alert.targetPrice 
        : asset.price <= alert.targetPrice;

      if (isTriggered) {
        alert.status = 'triggered';
        dbChanged = true;
        
        // Notify user via WS
        const notification = JSON.stringify({
          type: 'alert_triggered',
          alert
        });
        userClients.get(alert.userId)?.forEach(client => {
          if (client.readyState === 1) client.send(notification);
        });
      }
    });
    if (dbChanged) saveDB(db);

    const data = JSON.stringify({
      type: 'price_update',
      assets: updates,
      time: Date.now()
    });

    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  }, 1000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Live Trading Server running on http://localhost:${PORT}`);
  });
}

startServer();
