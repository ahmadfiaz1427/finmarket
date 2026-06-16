import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Market Data Memory Cache
let marketData = {
  crypto: [] as any[],
  metals: [] as any[],
  lastUpdated: 0,
};

// Simulated mock data for fallback or initial load
const MOCK_CRYPTO = [
  { id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 64230.12, price_change_percentage_24h: 2.34, market_cap: 1250000000000, total_volume: 35000000000 },
  { id: "ethereum", symbol: "eth", name: "Ethereum", current_price: 3450.80, price_change_percentage_24h: 1.15, market_cap: 415000000000, total_volume: 15000000000 },
  { id: "solana", symbol: "sol", name: "Solana", current_price: 145.20, price_change_percentage_24h: -5.4, market_cap: 67000000000, total_volume: 5000000000 },
  { id: "binancecoin", symbol: "bnb", name: "BNB", current_price: 590.50, price_change_percentage_24h: 0.8, market_cap: 90000000000, total_volume: 2000000000 },
  { id: "ripple", symbol: "xrp", name: "XRP", current_price: 0.58, price_change_percentage_24h: -1.2, market_cap: 32000000000, total_volume: 1500000000 },
  { id: "dogecoin", symbol: "doge", name: "Dogecoin", current_price: 0.12, price_change_percentage_24h: 4.5, market_cap: 17000000000, total_volume: 1200000000 },
  { id: "cardano", symbol: "ada", name: "Cardano", current_price: 0.45, price_change_percentage_24h: -0.5, market_cap: 16000000000, total_volume: 400000000 },
];

const MOCK_METALS = [
  { id: "gold", name: "Gold", current_price_oz: 2340.50, price_change_percentage_24h: 0.5 },
  { id: "silver", name: "Silver", current_price_oz: 29.80, price_change_percentage_24h: 1.2 },
  { id: "platinum", name: "Platinum", current_price_oz: 980.20, price_change_percentage_24h: -0.3 },
  { id: "palladium", name: "Palladium", current_price_oz: 1050.00, price_change_percentage_24h: 0.1 },
];

const METALS_CONVERSION = {
  gram: 0.035274,
  tola: 0.4114,
};

async function fetchCryptoData() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1");
    if (res.ok) {
      const data = await res.json();
      marketData.crypto = data;
      marketData.lastUpdated = Date.now();
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

app.get("/api/market/crypto", async (req, res) => {
  // refresh every 5 mins
  if (Date.now() - marketData.lastUpdated > 5 * 60 * 1000) {
    const success = await fetchCryptoData();
    if (!success && marketData.crypto.length === 0) {
      marketData.crypto = MOCK_CRYPTO;
    }
  }
  res.json(marketData.crypto.length > 0 ? marketData.crypto : MOCK_CRYPTO);
});

app.get("/api/market/metals", (req, res) => {
  // Compute grams and tola for metals dynamically based on simulated real-time variation
  const jitter = () => (Math.random() - 0.5) * 0.002; // Small random variation 
  
  const metalsWithVariations = MOCK_METALS.map(metal => {
    const price = metal.current_price_oz * (1 + jitter());
    return {
      ...metal,
      current_price_oz: price,
      current_price_gram: price * METALS_CONVERSION.gram,
      current_price_tola: price * METALS_CONVERSION.tola,
    };
  });
  res.json(metalsWithVariations);
});

// Gemini AI Insights
app.post("/api/insights", async (req, res) => {
  const { marketContext } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Gemini API key is missing. Add it to environment variables." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert financial market analyst. Provide a short, structured 3-bullet market insight analysis based on this context. Keep it highly professional like Bloomberg. Context: ${JSON.stringify(marketContext)}`,
    });
    
    res.json({ insights: response.text });
  } catch (err: any) {
    console.error("AI Error:", err);
    res.status(500).json({ error: "Failed to generate market insights. Ensure Gemini API Key is valid." });
  }
});

async function startServer() {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
