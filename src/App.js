import React, { useState, useEffect, useRef, useCallback } from "react";

function calcEMA(closes, period) {
  if (!closes || closes.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcVWAP(candles) {
  let cumTV = 0;
  let cumV = 0;
  return candles.map((c) => {
    const tp = (c.high + c.low + c.close) / 3;
    cumTV += tp * c.volume;
    cumV += c.volume;
    return cumV === 0 ? c.close : cumTV / cumV;
  });
}

function calcRSI(closes, period) {
  if (!closes || closes.length < period + 1) return [];
  const result = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d >= 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }

  return result;
}

function calcStochRSI(closes) {
  const rsi = calcRSI(closes, 14);
  if (rsi.length < 14) return { k: [], d: [] };

  const raw = [];
  for (let i = 13; i < rsi.length; i++) {
    const slice = rsi.slice(i - 13, i + 1);
    const lo = Math.min(...slice);
    const hi = Math.max(...slice);
    raw.push(hi === lo ? 50 : ((rsi[i] - lo) / (hi - lo)) * 100);
  }

  const sma = (arr, p) =>
    arr
      .map((_, i) =>
        i < p - 1
          ? null
          : arr.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p
      )
      .filter((v) => v !== null);

  const k = sma(raw, 3);
  const d = sma(k, 3);
  return { k, d };
}

function calcATR(candles, period) {
  if (!candles || candles.length < period + 1) return [];

  const trs = candles.slice(1).map((c, i) => {
    const prev = candles[i];
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    );
  });

  if (trs.length < period) return [];

  const result = [];
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(atr);

  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push(atr);
  }

  return result;
}

function calcVolRatio(volumes) {
  if (!volumes || volumes.length < 21) return 1;
  const avg = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  return avg === 0 ? 1 : volumes[volumes.length - 1] / avg;
}

function detectPattern(candles) {
  const [c1, c2, c3] = candles.slice(-3);
  if (!c1 || !c2 || !c3) return "No data";

  const body = (c) => Math.abs(c.close - c.open);
  const isBull = (c) => c.close > c.open;
  const isBear = (c) => c.close < c.open;
  const lw = (c) => Math.min(c.open, c.close) - c.low;
  const uw = (c) => c.high - Math.max(c.open, c.close);

  if (
    isBear(c2) &&
    isBull(c3) &&
    c3.open < c2.close &&
    c3.close > c2.open
  ) {
    return "Bullish Engulfing";
  }

  if (
    isBull(c2) &&
    isBear(c3) &&
    c3.open > c2.close &&
    c3.close < c2.open
  ) {
    return "Bearish Engulfing";
  }

  if (lw(c3) > body(c3) * 2 && uw(c3) < body(c3)) return "Hammer";
  if (uw(c3) > body(c3) * 2 && lw(c3) < body(c3)) return "Shooting Star";
  if (body(c3) < (c3.high - c3.low) * 0.1) return "Doji";
  if ([c1, c2, c3].every(isBull)) return "3 Green Candles";
  if ([c1, c2, c3].every(isBear)) return "3 Red Candles";
  return "No pattern";
}

function buildSnap(candles) {
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const price = closes[closes.length - 1] || 0;

  const e7a = calcEMA(closes, 7);
  const e25a = calcEMA(closes, 25);
  const e99a = calcEMA(closes, 99);

  const ema7 = e7a[e7a.length - 1] ?? price;
  const ema25 = e25a[e25a.length - 1] ?? price;
  const ema99 = e99a[e99a.length - 1] ?? price;

  const vwapA = calcVWAP(candles);
  const vwap = vwapA[vwapA.length - 1] ?? price;

  const st = calcStochRSI(closes);
  const stK = st.k[st.k.length - 1] ?? 50;
  const stD = st.d[st.d.length - 1] ?? 50;
  const prevK = st.k[st.k.length - 2] ?? stK;
  const prevD = st.d[st.d.length - 2] ?? stD;

  const atrA = calcATR(candles, 14);
  const atr = atrA[atrA.length - 1] ?? price * 0.002;

  const volR = calcVolRatio(vols);
  const pat = detectPattern(candles);

  const lookback = candles.slice(-30);
  const hiR = lookback.length ? Math.max(...lookback.map((c) => c.high)) : price;
  const loR = lookback.length ? Math.min(...lookback.map((c) => c.low)) : price;

  const bull = ema7 > ema25 && ema25 > ema99;
  const bear = ema7 < ema25 && ema25 < ema99;
  const emaS = bull ? "BULLISH" : bear ? "BEARISH" : "MIXED";

  let stCross = "NEUTRAL";
  if (prevK < prevD && stK > stD && stK < 30) stCross = "BULL CROSS oversold";
  else if (prevK > prevD && stK < stD && stK > 70) stCross = "BEAR CROSS overbought";
  else if (stK > stD) stCross = "K above D";
  else stCross = "K below D";

  const volS =
    volR > 1.8 ? "HIGH" :
    volR > 1.2 ? "ABOVE AVG" :
    volR < 0.7 ? "LOW" :
    "NORMAL";

  const vsV =
    price > vwap * 1.001 ? "ABOVE" :
    price < vwap * 0.999 ? "BELOW" :
    "AT";

  let score = 0;
  if (bull) score += 3;
  else if (bear) score -= 3;

  if (price > vwap) score += 2;
  else score -= 2;

  if (stK < 20 && stK > stD) score += 3;
  else if (stK > 80 && stK < stD) score -= 3;
  else if (stK > stD) score += 1;
  else score -= 1;

  if (volR > 1.5) score += Math.sign(score || 1);

  if (pat.includes("Bull") || pat.includes("Hammer") || pat.includes("Green")) score += 1;
  if (pat.includes("Bear") || pat.includes("Shoot") || pat.includes("Red")) score -= 1;

  return {
    price,
    ema7,
    ema25,
    ema99,
    vwap,
    stK,
    stD,
    atr,
    volR,
    emaS,
    stCross,
    volS,
    vsV,
    pat,
    hiR,
    loR,
    score,
    e7a,
    e25a,
    e99a,
    vwapA,
    slL: price - atr * 1.5,
    tp1L: price + atr * 1.5,
    tp2L: price + atr * 3,
    slS: price + atr * 1.5,
    tp1S: price - atr * 1.5,
    tp2S: price - atr * 3,
  };
}

function buildLowErrorDecision(snaps, market, config) {
  const s1 = snaps["1m"];
  const s5 = snaps["5m"];
  const s15 = snaps["15m"];

  if (!s1 || !s5 || !s15 || !market) {
    return {
      direction: "WAIT",
      confidence: 0,
      risk: "HIGH",
      reason: "Missing data.",
      blockers: ["Missing timeframe or market data"],
    };
  }

  const cfg = Object.assign(
    {
      maxSpreadPct: 0.025,
      minVolRatio: 0.9,
      maxAtrPct: 0.9,
      minAtrPct: 0.05,
      minScoreAbs: 3,
      maxFundingAbs: 0.0005,
    },
    config || {}
  );

  const blockers = [];
  const spreadPct = market.book.spreadPct;
  const fundingAbs = Math.abs(market.funding.lastFundingRate || 0);
  const atrPct = s15.price === 0 ? 999 : (s15.atr / s15.price) * 100;

  const signs = [s1.score, s5.score, s15.score].map((x) => Math.sign(x));
  const allBull = signs.every((x) => x > 0);
  const allBear = signs.every((x) => x < 0);
  const aligned = allBull || allBear;
  const avgScore = (s1.score + s5.score + s15.score) / 3;

  if (!aligned) blockers.push("1m, 5m, and 15m are not aligned");
  if (Math.abs(avgScore) < cfg.minScoreAbs) blockers.push("Average score is too weak");
  if (spreadPct > cfg.maxSpreadPct) blockers.push("Spread too wide");
  if (s15.volR < cfg.minVolRatio) blockers.push("Volume too low");
  if (atrPct > cfg.maxAtrPct) blockers.push("ATR too high, wick risk elevated");
  if (atrPct < cfg.minAtrPct) blockers.push("ATR too low, not enough movement after fees");
  if (fundingAbs > cfg.maxFundingAbs) blockers.push("Funding too aggressive");

  const trendLong =
    s15.emaS === "BULLISH" &&
    s5.emaS !== "BEARISH" &&
    s15.price > s15.vwap &&
    s5.price > s5.vwap;

  const trendShort =
    s15.emaS === "BEARISH" &&
    s5.emaS !== "BULLISH" &&
    s15.price < s15.vwap &&
    s5.price < s5.vwap;

  if (allBull && !trendLong) blockers.push("Long bias lacks EMA/VWAP confirmation");
  if (allBear && !trendShort) blockers.push("Short bias lacks EMA/VWAP confirmation");

  let direction = "WAIT";
  if (blockers.length === 0) {
    if (allBull && trendLong) direction = "LONG";
    if (allBear && trendShort) direction = "SHORT";
  }

  const confidence =
    direction === "WAIT"
      ? Math.max(5, Math.min(45, Math.round(50 - blockers.length * 8)))
      : Math.max(
          55,
          Math.min(
            90,
            Math.round(
              60 +
                Math.abs(avgScore) * 4 +
                Math.min(s15.volR, 2) * 5 -
                spreadPct * 500
            )
          )
        );

  let risk = "MEDIUM";
  if (direction === "WAIT" || blockers.length >= 2) risk = "HIGH";
  else if (spreadPct < cfg.maxSpreadPct * 0.6 && s15.volR > 1.2 && atrPct < 0.5) risk = "LOW";

  return {
    direction,
    confidence,
    risk,
    reason:
      direction === "WAIT"
        ? "No trade. " + blockers.join("; ")
        : direction +
          " allowed. MTF aligned, spread acceptable, volume valid, ATR acceptable, and VWAP/EMA confirmation present.",
    blockers,
    spreadPct,
    atrPct,
    fundingRate: market.funding.lastFundingRate,
    bid: market.book.bid,
    ask: market.book.ask,
  };
}

function calcPositionSize(accountUsd, riskPct, entry, stop, leverage) {
  const riskUsd = accountUsd * (riskPct / 100);
  const stopDistance = Math.abs(entry - stop);

  if (!entry || !stop || stopDistance === 0 || !isFinite(stopDistance)) {
    return {
      riskUsd: 0,
      qty: 0,
      notional: 0,
      marginNeeded: 0,
    };
  }

  const qty = riskUsd / stopDistance;
  const notional = qty * entry;
  const marginNeeded = leverage > 0 ? notional / leverage : notional;

  return {
    riskUsd,
    qty,
    notional,
    marginNeeded,
  };
}

async function fetchKlines(symbol, tf) {
  const r = await fetch(
    "https://fapi.binance.com/fapi/v1/klines?symbol=" +
      symbol +
      "&interval=" +
      tf +
      "&limit=200"
  );
  if (!r.ok) throw new Error("Binance Futures error " + r.status);

  const d = await r.json();
  return d.map((k) => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

async function fetchBookTicker(symbol) {
  const r = await fetch(
    "https://fapi.binance.com/fapi/v1/ticker/bookTicker?symbol=" + symbol
  );
  if (!r.ok) throw new Error("Book ticker error " + r.status);

  const d = await r.json();
  const bid = parseFloat(d.bidPrice);
  const ask = parseFloat(d.askPrice);
  const mid = (bid + ask) / 2;
  const spreadPct = mid === 0 ? 999 : ((ask - bid) / mid) * 100;

  return {
    bid,
    ask,
    mid,
    spreadPct,
  };
}

async function fetchFunding(symbol) {
  const r = await fetch(
    "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=" + symbol
  );
  if (!r.ok) throw new Error("Funding error " + r.status);

  const d = await r.json();

  return {
    markPrice: parseFloat(d.markPrice),
    indexPrice: parseFloat(d.indexPrice),
    lastFundingRate: parseFloat(d.lastFundingRate),
    nextFundingTime: d.nextFundingTime,
  };
}

async function askAI(apiKey, model, sys, user, onToken) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "ScalpAI",
    },
    body: JSON.stringify({
      model: model,
      stream: true,
      max_tokens: 500,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const e = await res.text();
    throw new Error("API error " + res.status + ": " + e);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;

    buffer += dec.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      if (line.includes("[DONE]")) continue;

      try {
        const j = JSON.parse(line.slice(6));
        const t =
          j.choices &&
          j.choices[0] &&
          j.choices[0].delta &&
          j.choices[0].delta.content;

        if (t) {
          full += t;
          onToken(full);
        }
      } catch (e2) {
        // ignore partial / malformed lines
      }
    }
  }

  return full;
}

function extractJsonBlock(text) {
  if (!text) return null;

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1];

  const loose = text.match(/\{[\s\S]*\}/);
  if (loose) return loose[0];

  return null;
}

function fmt(v, d) {
  if (v === undefined || v === null || Number.isNaN(v)) return "--";
  return Number(v).toFixed(d !== undefined ? d : 2);
}

function MiniChart(props) {
  const candles = props.candles;
  const e7 = props.e7 || [];
  const e25 = props.e25 || [];
  const vw = props.vw || [];

  if (!candles || candles.length < 2) return null;

  const last = candles.slice(-50);
  const W = 600;
  const H = 100;

  const hi = Math.max.apply(
    null,
    last.map(function (c) {
      return c.high;
    })
  );

  const lo = Math.min.apply(
    null,
    last.map(function (c) {
      return c.low;
    })
  );

  const range = hi - lo || 1;
  const xS = (W - 8) / last.length;

  const yP = function (v) {
    return H - 4 - ((v - lo) / range) * (H - 12);
  };

  const xP = function (i) {
    return 4 + i * xS + xS / 2;
  };

  const lp = function (arr) {
    const subset = arr.slice(-50);
    return subset
      .map(function (v, i) {
        return xP(i) + "," + yP(v);
      })
      .join(" ");
  };

  return React.createElement(
    "svg",
    {
      viewBox: "0 0 " + W + " " + H,
      style: { width: "100%", height: "85px", display: "block" },
    },
    last.map(function (c, i) {
      const x = xP(i);
      const cw = Math.max(xS * 0.6, 1);
      const bull = c.close >= c.open;
      const col = bull ? "#22c55e" : "#ef4444";
      const bTop = yP(Math.max(c.open, c.close));
      const bH = Math.max(Math.abs(yP(c.open) - yP(c.close)), 1);

      return React.createElement(
        "g",
        { key: i },
        React.createElement("line", {
          x1: x,
          y1: yP(c.high),
          x2: x,
          y2: yP(c.low),
          stroke: col,
          strokeWidth: "0.8",
          opacity: "0.5",
        }),
        React.createElement("rect", {
          x: x - cw / 2,
          y: bTop,
          width: cw,
          height: bH,
          fill: col,
          opacity: "0.9",
        })
      );
    }),
    e7.length > 1 &&
      React.createElement("polyline", {
        points: lp(e7),
        fill: "none",
        stroke: "#60a5fa",
        strokeWidth: "1.2",
      }),
    e25.length > 1 &&
      React.createElement("polyline", {
        points: lp(e25),
        fill: "none",
        stroke: "#f59e0b",
        strokeWidth: "1.2",
      }),
    vw.length > 1 &&
      React.createElement("polyline", {
        points: lp(vw),
        fill: "none",
        stroke: "#a855f7",
        strokeWidth: "1",
        strokeDasharray: "3,2",
      })
  );
}

function Cell(props) {
  return React.createElement(
    "div",
    {
      style: {
        background: "#0d0d14",
        borderRadius: "7px",
        padding: "8px 10px",
        border: "1px solid #1a1a2a",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          color: "#444",
          fontSize: "9px",
          fontFamily: "monospace",
          letterSpacing: "1px",
          marginBottom: "3px",
        },
      },
      props.label
    ),
    React.createElement(
      "div",
      {
        style: {
          color: props.color || "#e2e8f0",
          fontWeight: 700,
          fontSize: "12px",
          fontFamily: "monospace",
        },
      },
      props.value
    ),
    props.sub &&
      React.createElement(
        "div",
        { style: { color: "#555", fontSize: "9px", marginTop: "1px" } },
        props.sub
      )
  );
}

function TFCard(props) {
  const s = props.snap;
  if (!s) return null;

  const dir = s.score >= 3 ? "LONG" : s.score <= -3 ? "SHORT" : "WAIT";
  const col = dir === "LONG" ? "#22c55e" : dir === "SHORT" ? "#ef4444" : "#f59e0b";

  return React.createElement(
    "div",
    {
      style: {
        flex: 1,
        background: "#08080f",
        border: "1px solid " + col + "44",
        borderRadius: "8px",
        padding: "10px",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          color: "#444",
          fontSize: "9px",
          fontFamily: "monospace",
          marginBottom: "3px",
        },
      },
      props.tf
    ),
    React.createElement(
      "div",
      {
        style: {
          color: col,
          fontWeight: 900,
          fontSize: "15px",
          fontFamily: "monospace",
          marginBottom: "3px",
        },
      },
      dir
    ),
    React.createElement(
      "div",
      { style: { color: "#333", fontSize: "9px" } },
      "Score " + (s.score > 0 ? "+" : "") + s.score
    ),
    React.createElement(
      "div",
      { style: { color: "#333", fontSize: "9px" } },
      s.emaS
    ),
    React.createElement(
      "div",
      { style: { color: "#333", fontSize: "9px" } },
      "K " + fmt(s.stK, 1)
    )
  );
}

function AgentBox(props) {
  const cfg = {
    technical: { color: "#3b82f6", label: "AGENT 01  TECHNICAL" },
    fundamental: { color: "#22c55e", label: "AGENT 02  FUNDAMENTAL" },
    synthesis: { color: "#a855f7", label: "AGENT 03  SYNTHESIS" },
  };

  const c = cfg[props.id];
  const loading = props.status === "loading";
  const done = props.status === "done";
  const text = (loading ? props.stream : props.output) || "";

  const clean = text
    .replace(/```json[\s\S]*?```/g, "")
    .replace(/\*\*/g, "")
    .replace(/##/g, "")
    .replace(/^#+\s/gm, "")
    .trim();

  return React.createElement(
    "div",
    {
      style: {
        background: "#08080f",
        border: "1px solid " + (done ? c.color + "55" : loading ? c.color + "33" : "#141420"),
        borderRadius: "10px",
        padding: "14px",
        minHeight: "70px",
        position: "relative",
        overflow: "hidden",
      },
    },
    loading &&
      React.createElement("div", {
        style: {
          position: "absolute",
          top: 0,
          left: "-100%",
          width: "100%",
          height: "1px",
          background: "linear-gradient(90deg, transparent, " + c.color + ", transparent)",
          animation: "sweep 1.2s linear infinite",
        },
      }),
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        },
      },
      React.createElement("div", {
        style: {
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: done || loading ? c.color : "#222",
          boxShadow: done || loading ? "0 0 5px " + c.color : "none",
          animation: loading ? "pulse 1s infinite" : "none",
        },
      }),
      React.createElement(
        "span",
        {
          style: {
            color: c.color,
            fontFamily: "monospace",
            fontSize: "10px",
            letterSpacing: "2px",
            fontWeight: 700,
          },
        },
        c.label
      ),
      done &&
        React.createElement(
          "span",
          {
            style: {
              marginLeft: "auto",
              color: c.color + "66",
              fontSize: "10px",
            },
          },
          "done"
        ),
      loading &&
        React.createElement(
          "span",
          { style: { marginLeft: "auto", color: "#333", fontSize: "10px" } },
          "thinking..."
        )
    ),
    React.createElement(
      "div",
      {
        style: {
          color: "#9ba3b8",
          fontSize: "12px",
          lineHeight: "1.75",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        },
      },
      props.status === "idle"
        ? React.createElement(
            "span",
            { style: { color: "#1e1e2e", fontFamily: "monospace" } },
            "// standby"
          )
        : clean,
      loading &&
        React.createElement(
          "span",
          { style: { color: c.color, animation: "blink 0.7s infinite" } },
          "█"
        )
    )
  );
}

function SignalBox(props) {
  const pred = props.pred;
  const snap = props.snap;

  if (!pred || !snap) return null;

  const isL = pred.direction === "LONG";
  const isS = pred.direction === "SHORT";
  const col = isL ? "#22c55e" : isS ? "#ef4444" : "#f59e0b";

  const sl = isL ? snap.slL : isS ? snap.slS : null;
  const tp1 = isL ? snap.tp1L : isS ? snap.tp1S : null;
  const tp2 = isL ? snap.tp2L : isS ? snap.tp2S : null;

  const rr =
    tp1 && sl
      ? (Math.abs(tp1 - snap.price) / Math.abs(sl - snap.price)).toFixed(1)
      : null;

  const pos =
    props.accountUsd && props.riskPct && props.leverage && sl
      ? calcPositionSize(
          props.accountUsd,
          props.riskPct,
          snap.price,
          sl,
          props.leverage
        )
      : null;

  const cells = [
    { label: "ENTRY", val: "$" + fmt(snap.price), c: "#94a3b8" },
    { label: "STOP LOSS", val: sl ? "$" + fmt(sl) : "--", c: "#ef4444" },
    { label: "TP 1", val: tp1 ? "$" + fmt(tp1) : "--", c: "#22c55e" },
    { label: "TP 2", val: tp2 ? "$" + fmt(tp2) : "--", c: "#22c55e" },
    { label: "ATR", val: "$" + fmt(snap.atr, 3), c: "#555" },
    { label: "SUPPORT", val: "$" + fmt(snap.loR), c: "#3b82f6" },
    { label: "QTY", val: pos ? pos.qty.toFixed(4) : "--", c: "#94a3b8" },
    { label: "MARGIN", val: pos ? "$" + fmt(pos.marginNeeded, 2) : "--", c: "#f59e0b" },
    { label: "RISK USD", val: pos ? "$" + fmt(pos.riskUsd, 2) : "--", c: "#ef4444" },
  ];

  return React.createElement(
    "div",
    {
      style: {
        background: "#060609",
        border: "2px solid " + col,
        borderRadius: "14px",
        padding: "18px",
        boxShadow: "0 0 30px " + col + "15",
      },
    },
    React.createElement(
      "div",
      { style: { textAlign: "center", marginBottom: "16px" } },
      React.createElement(
        "div",
        {
          style: {
            color: "#333",
            fontFamily: "monospace",
            fontSize: "9px",
            letterSpacing: "3px",
            marginBottom: "8px",
          },
        },
        "FINAL SIGNAL"
      ),
      React.createElement(
        "div",
        {
          style: {
            fontSize: "30px",
            fontWeight: 900,
            color: col,
            fontFamily: "monospace",
            letterSpacing: "3px",
            textShadow: "0 0 20px " + col + "66",
          },
        },
        isL ? "LONG" : isS ? "SHORT" : "WAIT"
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "center",
            gap: "18px",
            marginTop: "8px",
            flexWrap: "wrap",
          },
        },
        React.createElement(
          "span",
          { style: { color: "#555", fontSize: "11px" } },
          "Confidence ",
          React.createElement(
            "span",
            { style: { color: col, fontWeight: 700 } },
            (pred.confidence ?? 0) + "%"
          )
        ),
        React.createElement(
          "span",
          { style: { color: "#555", fontSize: "11px" } },
          "Risk ",
          React.createElement(
            "span",
            {
              style: {
                color:
                  pred.risk === "HIGH"
                    ? "#ef4444"
                    : pred.risk === "LOW"
                    ? "#22c55e"
                    : "#f59e0b",
                fontWeight: 700,
              },
            },
            pred.risk || "HIGH"
          )
        ),
        rr &&
          React.createElement(
            "span",
            { style: { color: "#555", fontSize: "11px" } },
            "R:R ",
            React.createElement(
              "span",
              { style: { color: "#94a3b8", fontWeight: 700 } },
              "1:" + rr
            )
          )
      )
    ),
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "6px",
          marginBottom: "12px",
        },
      },
      cells.map(function (cell) {
        return React.createElement(
          "div",
          {
            key: cell.label,
            style: {
              background: "#0d0d14",
              borderRadius: "6px",
              padding: "7px 9px",
              border: "1px solid #111",
            },
          },
          React.createElement(
            "div",
            {
              style: {
                color: "#333",
                fontSize: "9px",
                fontFamily: "monospace",
                marginBottom: "2px",
              },
            },
            cell.label
          ),
          React.createElement(
            "div",
            {
              style: {
                color: cell.c,
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: "monospace",
              },
            },
            cell.val
          )
        );
      })
    ),
    React.createElement(
      "div",
      {
        style: {
          background: "#0a0a12",
          borderRadius: "8px",
          padding: "11px",
          border: "1px solid #111",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            color: "#333",
            fontSize: "9px",
            fontFamily: "monospace",
            marginBottom: "5px",
            letterSpacing: "2px",
          },
        },
        "RATIONALE"
      ),
      React.createElement(
        "div",
        { style: { color: "#7a8499", fontSize: "12px", lineHeight: "1.75" } },
        pred.reasoning || pred.reason || "No rationale."
      )
    )
  );
}

function LoginPage(props) {
  const [key, setKey] = useState("");
  const [model, setModel] = useState("meta-llama/llama-3.1-8b-instruct:free");

  const models = [
    { id: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B  FREE" },
    { id: "mistralai/mistral-7b-instruct:free", label: "Mistral 7B  FREE" },
    { id: "anthropic/claude-3.5-haiku", label: "Claude Haiku  Better Quality" },
    { id: "google/gemini-flash-1.5", label: "Gemini Flash  Fast" },
  ];

  const inp = {
    width: "100%",
    background: "#0d0d16",
    border: "1px solid #1a1a28",
    borderRadius: "7px",
    color: "#e2e8f0",
    padding: "10px 12px",
    fontSize: "13px",
    fontFamily: "monospace",
    boxSizing: "border-box",
    outline: "none",
  };

  return React.createElement(
    "div",
    {
      style: {
        minHeight: "100vh",
        background: "#05050a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      },
    },
    React.createElement(
      "div",
      { style: { width: "100%", maxWidth: "380px" } },
      React.createElement(
        "div",
        { style: { textAlign: "center", marginBottom: "28px" } },
        React.createElement(
          "div",
          { style: { fontSize: "32px", fontWeight: 900, fontFamily: "monospace" } },
          React.createElement("span", { style: { color: "#3b82f6" } }, "SCALP"),
          React.createElement("span", { style: { color: "#333" } }, "."),
          React.createElement("span", { style: { color: "#a855f7" } }, "AI")
        ),
        React.createElement(
          "div",
          {
            style: {
              color: "#333",
              fontSize: "11px",
              fontFamily: "monospace",
              marginTop: "6px",
            },
          },
          "Multi-Timeframe  3-Agent  Binance Futures Live"
        )
      ),
      React.createElement(
        "div",
        {
          style: {
            background: "#08080f",
            border: "1px solid #1a1a28",
            borderRadius: "12px",
            padding: "22px",
          },
        },
        React.createElement(
          "div",
          { style: { marginBottom: "14px" } },
          React.createElement(
            "div",
            {
              style: {
                color: "#444",
                fontSize: "10px",
                fontFamily: "monospace",
                letterSpacing: "2px",
                marginBottom: "7px",
              },
            },
            "OPENROUTER API KEY"
          ),
          React.createElement("input", {
            type: "password",
            value: key,
            placeholder: "sk-or-v1-...",
            onChange: function (e) {
              setKey(e.target.value);
            },
            onKeyDown: function (e) {
              if (e.key === "Enter" && key.trim()) props.onSave(key.trim(), model);
            },
            style: inp,
          }),
          React.createElement(
            "div",
            { style: { color: "#2a2a3a", fontSize: "10px", marginTop: "5px" } },
            "openrouter.ai  →  Sign in  →  Keys  →  Create Key"
          )
        ),
        React.createElement(
          "div",
          { style: { marginBottom: "18px" } },
          React.createElement(
            "div",
            {
              style: {
                color: "#444",
                fontSize: "10px",
                fontFamily: "monospace",
                letterSpacing: "2px",
                marginBottom: "7px",
              },
            },
            "AI MODEL"
          ),
          React.createElement(
            "select",
            {
              value: model,
              onChange: function (e) {
                setModel(e.target.value);
              },
              style: Object.assign({}, inp, { cursor: "pointer" }),
            },
            models.map(function (m) {
              return React.createElement("option", { key: m.id, value: m.id }, m.label);
            })
          )
        ),
        React.createElement(
          "button",
          {
            onClick: function () {
              if (key.trim()) props.onSave(key.trim(), model);
            },
            disabled: !key.trim(),
            style: {
              width: "100%",
              background: key.trim()
                ? "linear-gradient(135deg, #1d4ed8, #7c3aed)"
                : "#111",
              border: "none",
              borderRadius: "7px",
              color: key.trim() ? "#fff" : "#333",
              padding: "12px",
              fontSize: "13px",
              fontWeight: 700,
              fontFamily: "monospace",
              cursor: key.trim() ? "pointer" : "not-allowed",
              letterSpacing: "2px",
            },
          },
          "ENTER MARKET"
        ),
        React.createElement(
          "div",
          {
            style: {
              marginTop: "14px",
              padding: "10px 12px",
              background: "#0a0a12",
              borderRadius: "7px",
            },
          },
          React.createElement(
            "div",
            {
              style: {
                color: "#2a2a3a",
                fontSize: "10px",
                fontFamily: "monospace",
                lineHeight: "2",
              },
            },
            React.createElement("div", null, "Llama 3.1 and Mistral 7B are FREE"),
            React.createElement("div", null, "Key stays in browser memory only"),
            React.createElement("div", null, "Real Binance Futures live data"),
            React.createElement("div", null, "1m + 5m + 15m analyzed together"),
            React.createElement("div", null, "No order execution inside this app")
          )
        )
      )
    )
  );
}

const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
const TFS = ["1m", "5m", "15m"];

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [snaps, setSnaps] = useState({});
  const [candles, setCandles] = useState([]);
  const [market, setMarket] = useState(null);
  const [rulePred, setRulePred] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [agSt, setAgSt] = useState({
    technical: "idle",
    fundamental: "idle",
    synthesis: "idle",
  });
  const [agStr, setAgStr] = useState({
    technical: "",
    fundamental: "",
    synthesis: "",
  });
  const [agOut, setAgOut] = useState({
    technical: "",
    fundamental: "",
    synthesis: "",
  });
  const [pred, setPred] = useState(null);
  const [running, setRunning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [accountUsd, setAccountUsd] = useState(100);
  const [riskPct, setRiskPct] = useState(0.5);
  const [leverage, setLeverage] = useState(3);
  const autoRef = useRef(null);

  const loadData = useCallback(
    async function () {
      setLoading(true);
      setErr("");

      try {
        const results = await Promise.all(
          TFS.map(function (tf) {
            return fetchKlines(symbol, tf);
          })
        );

        const ns = {};
        TFS.forEach(function (tf, i) {
          ns[tf] = buildSnap(results[i]);
        });

        const [book, funding] = await Promise.all([
          fetchBookTicker(symbol),
          fetchFunding(symbol),
        ]);

        const mkt = { book, funding };
        const lowError = buildLowErrorDecision(ns, mkt);

        setSnaps(ns);
        setCandles(results[2]);
        setMarket(mkt);
        setRulePred(lowError);
      } catch (e) {
        setErr(e.message || "Unknown error");
      }

      setLoading(false);
    },
    [symbol]
  );

  useEffect(
    function () {
      if (apiKey) loadData();
    },
    [loadData, apiKey]
  );

  useEffect(
    function () {
      if (auto) {
        autoRef.current = setInterval(loadData, 30000);
      } else {
        clearInterval(autoRef.current);
      }
      return function () {
        clearInterval(autoRef.current);
      };
    },
    [auto, loadData]
  );

  async function runAgents() {
    const s15 = snaps["15m"];
    const gate = rulePred;

    if (!s15 || !apiKey) return;

    if (!gate) {
      setErr("No low-error gate data yet. Refresh first.");
      return;
    }

    setRunning(true);
    setPred(null);

    setAgSt({ technical: "idle", fundamental: "idle", synthesis: "idle" });
    setAgOut({ technical: "", fundamental: "", synthesis: "" });
    setAgStr({ technical: "", fundamental: "", synthesis: "" });

    const coin = symbol.replace("USDT", "");

    const mtf = TFS.map(function (tf) {
      const s = snaps[tf];
      if (!s) return tf + ": no data";
      return (
        tf +
        ": $" +
        fmt(s.price) +
        " EMA=" +
        s.emaS +
        " K=" +
        fmt(s.stK, 1) +
        "/" +
        fmt(s.stD, 1) +
        " " +
        s.vsV +
        " VWAP Vol=" +
        s.volR.toFixed(2) +
        "x Score=" +
        s.score +
        "/10 Pat=" +
        s.pat
      );
    }).join("\n");

    const techSys =
      "You are a professional scalp trader with long experience. Analyze multiple timeframes. Write in plain text, no asterisks or hashtags, use CAPS for emphasis. Max 180 words. This is for educational analysis only, not execution advice.";

    const techUser =
      "LIVE DATA: " +
      symbol +
      "\n" +
      mtf +
      "\nATR=" +
      fmt(s15.atr, 3) +
      " Support=" +
      fmt(s15.loR) +
      " Resistance=" +
      fmt(s15.hiR) +
      "\nSpread=" +
      fmt(gate.spreadPct, 4) +
      "% Funding=" +
      gate.fundingRate +
      "\n\nDo timeframes align? Is this a high-probability scalp? LONG SHORT or WAIT and why?";

    setAgSt(function (a) {
      return Object.assign({}, a, { technical: "loading" });
    });

    let techOut = "";
    try {
      techOut = await askAI(apiKey, model, techSys, techUser, function (t) {
        setAgStr(function (a) {
          return Object.assign({}, a, { technical: t });
        });
      });
    } catch (e) {
      techOut = "Error: " + e.message;
    }

    setAgOut(function (a) {
      return Object.assign({}, a, { technical: techOut });
    });
    setAgSt(function (a) {
      return Object.assign({}, a, { technical: "done" });
    });

    const fundSys =
      "You are a crypto macro analyst. Write in plain text, no asterisks or hashtags, use CAPS for emphasis. Max 160 words. This is educational market commentary only.";

    const fundUser =
      "Assess the macro and broader market picture for " +
      coin +
      " right now for short-term scalping context. Mention risk sentiment, dollar strength, catalysts, funding behavior, and general market tone. End with LONG SHORT or NEUTRAL bias for scalping context only.";

    setAgSt(function (a) {
      return Object.assign({}, a, { fundamental: "loading" });
    });

    let fundOut = "";
    try {
      fundOut = await askAI(apiKey, model, fundSys, fundUser, function (t) {
        setAgStr(function (a) {
          return Object.assign({}, a, { fundamental: t });
        });
      });
    } catch (e) {
      fundOut = "Error: " + e.message;
    }

    setAgOut(function (a) {
      return Object.assign({}, a, { fundamental: fundOut });
    });
    setAgSt(function (a) {
      return Object.assign({}, a, { fundamental: "done" });
    });

    const synthSys =
      'You are a senior crypto trading strategist. Synthesize the inputs into a cautious educational signal. Write in plain text no asterisks or hashtags. If rule-based gate says WAIT, you MUST output NEUTRAL. At the very end output exactly this block:\n```json\n{"direction":"LONG","confidence":74,"risk":"MEDIUM","reasoning":"One plain sentence."}\n```\ndirection=LONG/SHORT/NEUTRAL confidence=0-100 risk=LOW/MEDIUM/HIGH';

    const synthUser =
      "TECHNICAL:\n" +
      techOut +
      "\n\nFUNDAMENTAL:\n" +
      fundOut +
      "\n\nRULE-BASED LOW-ERROR GATE:\n" +
      "Direction: " +
      gate.direction +
      "\nConfidence: " +
      gate.confidence +
      "%\nRisk: " +
      gate.risk +
      "\nReason: " +
      gate.reason +
      "\nSpread: " +
      gate.spreadPct.toFixed(4) +
      "%\nATR%: " +
      gate.atrPct.toFixed(3) +
      "%\nFunding: " +
      gate.fundingRate +
      "\nBlockers: " +
      (gate.blockers.length ? gate.blockers.join("; ") : "none") +
      "\n\nSCORES: " +
      TFS.map(function (tf) {
        return tf + "=" + (snaps[tf] ? snaps[tf].score : 0);
      }).join(" ") +
      "\nPrice=$" +
      fmt(s15.price) +
      " EMA=" +
      s15.emaS +
      " VWAP=" +
      s15.vsV +
      "\n\nIMPORTANT RULE: If the rule-based gate says WAIT, your final direction must be NEUTRAL. Do not override the gate.";

    setAgSt(function (a) {
      return Object.assign({}, a, { synthesis: "loading" });
    });

    let synthOut = "";
    try {
      synthOut = await askAI(apiKey, model, synthSys, synthUser, function (t) {
        setAgStr(function (a) {
          return Object.assign({}, a, { synthesis: t });
        });
      });
    } catch (e) {
      synthOut = "Error: " + e.message;
    }

    setAgOut(function (a) {
      return Object.assign({}, a, { synthesis: synthOut });
    });
    setAgSt(function (a) {
      return Object.assign({}, a, { synthesis: "done" });
    });

    const jsonText = extractJsonBlock(synthOut);

    if (jsonText) {
      try {
        const parsed = JSON.parse(jsonText);

        if (rulePred && rulePred.direction === "WAIT") {
          parsed.direction = "NEUTRAL";
          parsed.confidence = Math.min(parsed.confidence || 40, 45);
          parsed.risk = "HIGH";
          parsed.reasoning =
            "Rule-based low-error gate rejected the setup: " + rulePred.reason;
        }

        setPred(parsed);
      } catch (e2) {
        setPred({
          direction: rulePred && rulePred.direction !== "WAIT" ? rulePred.direction : "NEUTRAL",
          confidence: rulePred ? rulePred.confidence : 30,
          risk: rulePred ? rulePred.risk : "HIGH",
          reasoning: rulePred ? rulePred.reason : "AI JSON parsing failed.",
        });
      }
    } else {
      setPred({
        direction: rulePred && rulePred.direction !== "WAIT" ? rulePred.direction : "NEUTRAL",
        confidence: rulePred ? rulePred.confidence : 30,
        risk: rulePred ? rulePred.risk : "HIGH",
        reasoning: rulePred ? rulePred.reason : "No valid AI JSON returned.",
      });
    }

    setRunning(false);
  }

  if (!apiKey) {
    return React.createElement(LoginPage, {
      onSave: function (k, m) {
        setApiKey(k);
        setModel(m);
      },
    });
  }

  const s15 = snaps["15m"];
  const scores = TFS.map(function (tf) {
    return snaps[tf] ? snaps[tf].score : 0;
  });
  const avgScore = scores.length
    ? scores.reduce(function (a, b) {
        return a + b;
      }, 0) / scores.length
    : 0;

  const aligned =
    s15 &&
    TFS.every(function (tf) {
      return snaps[tf] && Math.sign(snaps[tf].score) === Math.sign(s15.score);
    });

  const btnStyle = {
    background: "#0d0d16",
    border: "1px solid #1a1a28",
    borderRadius: "6px",
    color: "#666",
    padding: "7px 12px",
    fontSize: "13px",
    fontFamily: "monospace",
    cursor: "pointer",
  };

  return React.createElement(
    "div",
    {
      style: {
        minHeight: "100vh",
        background: "#05050a",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
        padding: "14px 12px",
      },
    },
    React.createElement(
      "style",
      null,
      "@keyframes sweep { 0%{left:-100%} 100%{left:200%} }" +
        "@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }" +
        "@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }" +
        "* { box-sizing: border-box; } select,input { outline: none; }"
    ),
    React.createElement(
      "div",
      { style: { maxWidth: "740px", margin: "0 auto" } },

      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "14px",
          },
        },
        React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            { style: { fontSize: "20px", fontWeight: 900, fontFamily: "monospace" } },
            React.createElement("span", { style: { color: "#3b82f6" } }, "SCALP"),
            React.createElement("span", { style: { color: "#333" } }, "."),
            React.createElement("span", { style: { color: "#a855f7" } }, "AI"),
            React.createElement(
              "span",
              {
                style: {
                  color: "#222",
                  fontSize: "10px",
                  fontWeight: 400,
                  marginLeft: "8px",
                },
              },
              "MTF Futures Edition"
            )
          ),
          React.createElement(
            "div",
            {
              style: {
                color: "#222",
                fontSize: "9px",
                fontFamily: "monospace",
                marginTop: "2px",
              },
            },
            "1m  5m  15m  BINANCE FUTURES  OPENROUTER"
          )
        ),
        React.createElement(
          "button",
          {
            onClick: function () {
              setApiKey("");
              setModel("");
              setSnaps({});
              setCandles([]);
              setMarket(null);
              setRulePred(null);
              setPred(null);
            },
            style: Object.assign({}, btnStyle, { color: "#333", fontSize: "10px" }),
          },
          "logout"
        )
      ),

      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "12px",
            alignItems: "center",
          },
        },
        React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            {
              style: {
                color: "#333",
                fontSize: "9px",
                fontFamily: "monospace",
                marginBottom: "3px",
              },
            },
            "PAIR"
          ),
          React.createElement(
            "select",
            {
              value: symbol,
              onChange: function (e) {
                setSymbol(e.target.value);
              },
              style: {
                background: "#0d0d16",
                border: "1px solid #1a1a28",
                borderRadius: "6px",
                color: "#e2e8f0",
                padding: "7px 10px",
                fontSize: "13px",
                fontWeight: 700,
                fontFamily: "monospace",
                cursor: "pointer",
              },
            },
            PAIRS.map(function (p) {
              return React.createElement("option", { key: p }, p);
            })
          )
        ),
        React.createElement(
          "div",
          {
            style: {
              marginLeft: "auto",
              display: "flex",
              gap: "7px",
              alignItems: "center",
            },
          },
          React.createElement(
            "button",
            { onClick: loadData, disabled: loading, style: btnStyle },
            loading ? "..." : "↻"
          ),
          React.createElement(
            "label",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "5px",
                color: "#333",
                fontSize: "10px",
                fontFamily: "monospace",
                cursor: "pointer",
              },
            },
            React.createElement("input", {
              type: "checkbox",
              checked: auto,
              onChange: function (e) {
                setAuto(e.target.checked);
              },
              style: { accentColor: "#3b82f6" },
            }),
            "AUTO"
          ),
          React.createElement(
            "button",
            {
              onClick: runAgents,
              disabled: running || !s15,
              style: {
                background: running
                  ? "#0d0d16"
                  : "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                border: running ? "1px solid #1a1a28" : "none",
                borderRadius: "6px",
                color: running ? "#333" : "#fff",
                padding: "7px 16px",
                fontSize: "12px",
                fontWeight: 700,
                fontFamily: "monospace",
                cursor: running || !s15 ? "not-allowed" : "pointer",
                letterSpacing: "1px",
              },
            },
            running ? "RUNNING..." : "ANALYZE"
          )
        )
      ),

      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            marginBottom: "12px",
          },
        },
        React.createElement("input", {
          type: "number",
          value: accountUsd,
          onChange: function (e) {
            setAccountUsd(parseFloat(e.target.value) || 0);
          },
          placeholder: "Account USD",
          style: {
            background: "#0d0d16",
            border: "1px solid #1a1a28",
            borderRadius: "6px",
            color: "#e2e8f0",
            padding: "7px 10px",
            fontSize: "12px",
            fontFamily: "monospace",
            width: "110px",
          },
        }),
        React.createElement("input", {
          type: "number",
          value: riskPct,
          step: "0.1",
          onChange: function (e) {
            setRiskPct(parseFloat(e.target.value) || 0);
          },
          placeholder: "Risk %",
          style: {
            background: "#0d0d16",
            border: "1px solid #1a1a28",
            borderRadius: "6px",
            color: "#e2e8f0",
            padding: "7px 10px",
            fontSize: "12px",
            fontFamily: "monospace",
            width: "90px",
          },
        }),
        React.createElement("input", {
          type: "number",
          value: leverage,
          step: "1",
          onChange: function (e) {
            setLeverage(parseFloat(e.target.value) || 1);
          },
          placeholder: "Lev",
          style: {
            background: "#0d0d16",
            border: "1px solid #1a1a28",
            borderRadius: "6px",
            color: "#e2e8f0",
            padding: "7px 10px",
            fontSize: "12px",
            fontFamily: "monospace",
            width: "75px",
          },
        }),
        React.createElement(
          "div",
          {
            style: {
              color: "#444",
              fontSize: "10px",
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              paddingLeft: "4px",
            },
          },
          "Use small risk. This app is analysis-only."
        )
      ),

      err &&
        React.createElement(
          "div",
          {
            style: {
              background: "#1a0808",
              border: "1px solid #ef444433",
              borderRadius: "7px",
              padding: "8px 12px",
              color: "#ef4444",
              fontSize: "11px",
              fontFamily: "monospace",
              marginBottom: "10px",
            },
          },
          "Error: " + err
        ),

      Object.keys(snaps).length > 0 &&
        React.createElement(
          "div",
          { style: { marginBottom: "12px" } },
          React.createElement(
            "div",
            {
              style: {
                color: "#222",
                fontSize: "9px",
                fontFamily: "monospace",
                letterSpacing: "2px",
                marginBottom: "6px",
              },
            },
            "TIMEFRAME CONFLUENCE  " + (aligned ? "ALL ALIGNED" : "MIXED SIGNALS")
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: "6px" } },
            TFS.map(function (tf) {
              return React.createElement(TFCard, {
                key: tf,
                tf: tf,
                snap: snaps[tf],
              });
            }),
            React.createElement(
              "div",
              {
                style: {
                  flex: 2,
                  background: "#08080f",
                  border: "1px solid " + (aligned ? "#22c55e33" : "#f59e0b22"),
                  borderRadius: "8px",
                  padding: "10px",
                },
              },
              React.createElement(
                "div",
                {
                  style: {
                    color: "#333",
                    fontSize: "9px",
                    fontFamily: "monospace",
                    marginBottom: "3px",
                  },
                },
                "CONFLUENCE"
              ),
              React.createElement(
                "div",
                {
                  style: {
                    color: aligned ? "#22c55e" : "#f59e0b",
                    fontSize: "12px",
                    fontWeight: 700,
                  },
                },
                aligned ? "ALL ALIGNED" : "WAIT"
              ),
              React.createElement(
                "div",
                { style: { color: "#333", fontSize: "9px", marginTop: "3px" } },
                "Avg " + (avgScore > 0 ? "+" : "") + avgScore.toFixed(1) + "/10"
              )
            )
          )
        ),

      rulePred &&
        market &&
        s15 &&
        React.createElement(
          "div",
          {
            style: {
              background: "#08080f",
              border:
                "1px solid " +
                (rulePred.direction === "WAIT"
                  ? "#f59e0b33"
                  : rulePred.direction === "LONG"
                  ? "#22c55e33"
                  : "#ef444433"),
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "12px",
            },
          },
          React.createElement(
            "div",
            {
              style: {
                color: "#333",
                fontSize: "9px",
                fontFamily: "monospace",
                letterSpacing: "2px",
                marginBottom: "8px",
              },
            },
            "LOW-ERROR SCALPING GATE"
          ),
          React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: "6px",
                marginBottom: "8px",
              },
            },
            React.createElement(Cell, {
              label: "RULE SIGNAL",
              value: rulePred.direction,
              color:
                rulePred.direction === "LONG"
                  ? "#22c55e"
                  : rulePred.direction === "SHORT"
                  ? "#ef4444"
                  : "#f59e0b",
            }),
            React.createElement(Cell, {
              label: "SPREAD",
              value: rulePred.spreadPct.toFixed(4) + "%",
              color: rulePred.spreadPct <= 0.025 ? "#22c55e" : "#ef4444",
            }),
            React.createElement(Cell, {
              label: "ATR %",
              value: rulePred.atrPct.toFixed(3) + "%",
              color: rulePred.atrPct < 0.9 ? "#22c55e" : "#ef4444",
            }),
            React.createElement(Cell, {
              label: "FUNDING",
              value: (rulePred.fundingRate * 100).toFixed(4) + "%",
              color: Math.abs(rulePred.fundingRate) < 0.0005 ? "#22c55e" : "#f59e0b",
            }),
            React.createElement(Cell, {
              label: "BID",
              value: "$" + fmt(rulePred.bid),
              color: "#94a3b8",
            }),
            React.createElement(Cell, {
              label: "ASK",
              value: "$" + fmt(rulePred.ask),
              color: "#94a3b8",
            })
          ),
          React.createElement(
            "div",
            {
              style: {
                background: "#0a0a12",
                borderRadius: "7px",
                padding: "9px",
                color: "#7a8499",
                fontSize: "11px",
                lineHeight: "1.6",
              },
            },
            rulePred.reason
          )
        ),

      candles.length > 0 &&
        s15 &&
        React.createElement(
          "div",
          {
            style: {
              background: "#08080f",
              border: "1px solid #111",
              borderRadius: "10px",
              padding: "10px",
              marginBottom: "10px",
            },
          },
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "4px",
              },
            },
            React.createElement(
              "span",
              { style: { color: "#222", fontSize: "9px", fontFamily: "monospace" } },
              symbol + "  15m  50 candles"
            ),
            React.createElement(
              "div",
              { style: { display: "flex", gap: "8px" } },
              [["EMA7", "#60a5fa"], ["EMA25", "#f59e0b"], ["VWAP", "#a855f7"]].map(
                function (x) {
                  return React.createElement(
                    "span",
                    {
                      key: x[0],
                      style: { color: x[1], fontSize: "8px", fontFamily: "monospace" },
                    },
                    "- " + x[0]
                  );
                }
              )
            )
          ),
          React.createElement(MiniChart, {
            candles: candles,
            e7: s15.e7a,
            e25: s15.e25a,
            vw: s15.vwapA,
          })
        ),

      s15 &&
        React.createElement(
          "div",
          { style: { marginBottom: "12px" } },
          React.createElement(
            "div",
            {
              style: {
                color: "#333",
                fontSize: "9px",
                fontFamily: "monospace",
                letterSpacing: "2px",
                marginBottom: "6px",
              },
            },
            "15m INDICATORS"
          ),
          React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                gap: "6px",
                marginBottom: "6px",
              },
            },
            React.createElement(Cell, {
              label: "PRICE",
              value: "$" + fmt(s15.price),
              color: "#e2e8f0",
            }),
            React.createElement(Cell, {
              label: "EMA 7",
              value: "$" + fmt(s15.ema7),
              color: s15.price > s15.ema7 ? "#22c55e" : "#ef4444",
            }),
            React.createElement(Cell, {
              label: "EMA 25",
              value: "$" + fmt(s15.ema25),
              color: s15.price > s15.ema25 ? "#22c55e" : "#ef4444",
            }),
            React.createElement(Cell, {
              label: "EMA 99",
              value: "$" + fmt(s15.ema99),
              color: s15.price > s15.ema99 ? "#22c55e" : "#ef4444",
            }),
            React.createElement(Cell, {
              label: "VWAP",
              value: "$" + fmt(s15.vwap),
              color: s15.price > s15.vwap ? "#22c55e" : "#ef4444",
              sub: s15.vsV + " VWAP",
            }),
            React.createElement(Cell, {
              label: "STOCH K",
              value: fmt(s15.stK, 1),
              color:
                s15.stK < 20
                  ? "#22c55e"
                  : s15.stK > 80
                  ? "#ef4444"
                  : "#94a3b8",
              sub: "D: " + fmt(s15.stD, 1),
            }),
            React.createElement(Cell, {
              label: "ATR(14)",
              value: "$" + fmt(s15.atr, 3),
              color: "#94a3b8",
            }),
            React.createElement(Cell, {
              label: "VOL",
              value: s15.volR.toFixed(2) + "x",
              color:
                s15.volR > 1.5
                  ? "#22c55e"
                  : s15.volR < 0.7
                  ? "#ef4444"
                  : "#94a3b8",
              sub: s15.volS,
            }),
            React.createElement(Cell, {
              label: "SCORE",
              value: (s15.score > 0 ? "+" : "") + s15.score + "/10",
              color:
                s15.score >= 4
                  ? "#22c55e"
                  : s15.score <= -4
                  ? "#ef4444"
                  : "#f59e0b",
            })
          ),
          React.createElement(
            "div",
            { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" } },
            React.createElement(
              "div",
              {
                style: {
                  background: "#0d0d14",
                  borderRadius: "7px",
                  padding: "8px 10px",
                  border: "1px solid #1a1a2a",
                },
              },
              React.createElement(
                "div",
                {
                  style: {
                    color: "#444",
                    fontSize: "9px",
                    fontFamily: "monospace",
                    marginBottom: "3px",
                  },
                },
                "EMA RIBBON"
              ),
              React.createElement(
                "div",
                {
                  style: {
                    color:
                      s15.emaS === "BULLISH"
                        ? "#22c55e"
                        : s15.emaS === "BEARISH"
                        ? "#ef4444"
                        : "#f59e0b",
                    fontSize: "11px",
                    fontWeight: 700,
                  },
                },
                s15.emaS
              ),
              React.createElement(
                "div",
                { style: { color: "#555", fontSize: "9px", marginTop: "2px" } },
                s15.stCross
              )
            ),
            React.createElement(
              "div",
              {
                style: {
                  background: "#0d0d14",
                  borderRadius: "7px",
                  padding: "8px 10px",
                  border: "1px solid #1a1a2a",
                },
              },
              React.createElement(
                "div",
                {
                  style: {
                    color: "#444",
                    fontSize: "9px",
                    fontFamily: "monospace",
                    marginBottom: "3px",
                  },
                },
                "PATTERN"
              ),
              React.createElement(
                "div",
                { style: { color: "#94a3b8", fontSize: "11px" } },
                s15.pat
              )
            ),
            React.createElement(
              "div",
              {
                style: {
                  background: "#0d0d14",
                  borderRadius: "7px",
                  padding: "8px 10px",
                  border: "1px solid #1a1a2a",
                },
              },
              React.createElement(
                "div",
                {
                  style: {
                    color: "#444",
                    fontSize: "9px",
                    fontFamily: "monospace",
                    marginBottom: "3px",
                  },
                },
                "S / R"
              ),
              React.createElement(
                "div",
                { style: { color: "#22c55e", fontSize: "11px" } },
                "S: $" + fmt(s15.loR)
              ),
              React.createElement(
                "div",
                { style: { color: "#ef4444", fontSize: "11px" } },
                "R: $" + fmt(s15.hiR)
              )
            )
          )
        ),

      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            margin: "12px 0",
          },
        },
        React.createElement("div", { style: { flex: 1, height: "1px", background: "#111" } }),
        React.createElement(
          "span",
          {
            style: {
              color: "#1a1a2a",
              fontSize: "9px",
              fontFamily: "monospace",
              letterSpacing: "2px",
            },
          },
          "AGENT OUTPUT"
        ),
        React.createElement("div", { style: { flex: 1, height: "1px", background: "#111" } })
      ),

      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "12px",
          },
        },
        ["technical", "fundamental", "synthesis"].map(function (id) {
          return React.createElement(AgentBox, {
            key: id,
            id: id,
            status: agSt[id],
            stream: agStr[id],
            output: agOut[id],
          });
        })
      ),

      React.createElement(SignalBox, {
        pred: pred,
        snap: s15,
        accountUsd: accountUsd,
        riskPct: riskPct,
        leverage: leverage,
      }),

      React.createElement(
        "div",
        {
          style: {
            textAlign: "center",
            marginTop: "16px",
            color: "#111",
            fontSize: "9px",
            fontFamily: "monospace",
          },
        },
        "EDUCATIONAL ANALYSIS ONLY  •  NO AUTO-TRADING  •  PAPER TEST FIRST"
      )
    )
  );
}
