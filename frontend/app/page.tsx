"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Shield, AlertTriangle, Phone, CheckCircle2, XCircle, Activity, Network, Volume2, ArrowRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const W = 900, H = 580;
const NODE_COUNT = 180;
const BANK_COLORS = {
  HDFC:  { fill: "#10b981", dark: "#064e3b", label: "#34d399" },
  SBI:   { fill: "#3b82f6", dark: "#1e3a5f", label: "#60a5fa" },
  ICICI: { fill: "#8b5cf6", dark: "#3b1f6e", label: "#a78bfa" },
  AXIS:  { fill: "#f59e0b", dark: "#5c3d0a", label: "#fbbf24" },
  KOTAK: { fill: "#ec4899", dark: "#6b1f40", label: "#f472b6" },
  PNB:   { fill: "#06b6d4", dark: "#0c4a5a", label: "#22d3ee" },
};
const BANKS = Object.keys(BANK_COLORS);
const NAMES = ["rohan","priya","arjun","kavya","vikram","anita","rahul","deepa",
               "suresh","meera","ajay","neha","amit","pooja","ravi","sonia",
               "kiran","divya","manish","shreya","tarun","leena","rahil","farida"];

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC PRNG  (no Math.random — layout is always the same)
// ─────────────────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0xDEADBEEF);

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH GENERATION
// Nodes are placed in 6 loose bank-clusters so the graph looks organic.
// The mule ring cluster (nodes 0-14) is placed centre-right, tightly grouped,
// so when it lights up red it forms a clear visual blob.
// ─────────────────────────────────────────────────────────────────────────────
function makeGraph() {
  const nodes = [];
  const edges = [];

  // --- Cluster centres (in SVG coordinates) ---
  const centres = [
    { x: 560, y: 270 },  // cluster 0 — MULE RING (reserved)
    { x: 160, y: 140 },  // cluster 1
    { x: 750, y: 120 },  // cluster 2
    { x: 180, y: 430 },  // cluster 3
    { x: 750, y: 440 },  // cluster 4
    { x: 440, y: 100 },  // cluster 5
  ];

  // Victim is node 0, primary receiver is node 1, mules 2-8, layer2 9-13
  // All of these start in cluster 0 (the mule ring zone)
  const RING_SIZE = 14;

  for (let i = 0; i < NODE_COUNT; i++) {
    const bank = BANKS[i % BANKS.length];
    const name = NAMES[i % NAMES.length];
    const isRingNode = i < RING_SIZE;
    const clusterIdx = isRingNode ? 0 : 1 + (i % (centres.length - 1));
    const cx = centres[clusterIdx].x;
    const cy = centres[clusterIdx].y;
    const spread = isRingNode ? 55 : 110;
    // Jitter within the cluster
    const angle = rng() * Math.PI * 2;
    const radius = rng() * spread;
    nodes.push({
      id: i,
      vpa: i === 0 ? "grandma.kanta@hdfc"
         : i === 1 ? "cbi.safe@upi"
         : `${name}${i}@${bank.toLowerCase()}`,
      bank: i === 0 ? "HDFC" : bank,
      x: Math.max(18, Math.min(W - 18, cx + Math.cos(angle) * radius)),
      y: Math.max(18, Math.min(H - 18, cy + Math.sin(angle) * radius)),
      vx: 0, vy: 0,
      isVictim: i === 0,
      isPrimaryRecv: i === 1,
      isMule: i >= 2 && i <= 8,
      isLayer2: i >= 9 && i <= 13,
      pulseOffset: rng() * Math.PI * 2,
      r: i === 0 ? 9 : i === 1 ? 9 : i < RING_SIZE ? 6 : 4,
    });
  }

  // Background edges — sparse, within clusters + a few cross-cluster bridges
  const edgeSet = new Set();
  const addEdge = (s, t, w = 1) => {
    if (s === t) return;
    const key = s < t ? `${s}-${t}` : `${t}-${s}`;
    if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ s, t, w }); }
  };

  // Intra-cluster background
  for (let i = RING_SIZE; i < NODE_COUNT; i++) {
    const clI = 1 + (i % (centres.length - 1));
    const fan = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < fan; k++) {
      // pick neighbour in same cluster
      const candidates = nodes.filter((n, j) => j !== i && j >= RING_SIZE && (1 + (j % (centres.length - 1))) === clI);
      if (candidates.length) {
        const c = candidates[Math.floor(rng() * candidates.length)];
        addEdge(i, c.id);
      }
    }
  }
  // Cross-cluster bridges
  for (let k = 0; k < 18; k++) {
    const a = RING_SIZE + Math.floor(rng() * (NODE_COUNT - RING_SIZE));
    const b = RING_SIZE + Math.floor(rng() * (NODE_COUNT - RING_SIZE));
    addEdge(a, b, 0.5);
  }

  return { nodes, edges };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORCE-DIRECTED LAYOUT  — proper full N² repulsion (N=180 is fine for one-shot)
// Uses Fruchterman-Reingold with temperature cooling.
// ─────────────────────────────────────────────────────────────────────────────
function runLayout(nodes, edges, iterations = 160) {
  const pos = nodes.map(n => ({ x: n.x, y: n.y }));
  const k = Math.sqrt((W * H) / nodes.length) * 0.9;
  let temp = W * 0.12;

  for (let iter = 0; iter < iterations; iter++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));

    // Full repulsion — every pair
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const rep = (k * k) / d;
        const fx = (dx / d) * rep;
        const fy = (dy / d) * rep;
        disp[i].x += fx; disp[i].y += fy;
        disp[j].x -= fx; disp[j].y -= fy;
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const dx = pos[e.s].x - pos[e.t].x;
      const dy = pos[e.s].y - pos[e.t].y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const att = (d * d) / k * (e.w || 1);
      const fx = (dx / d) * att;
      const fy = (dy / d) * att;
      disp[e.s].x -= fx; disp[e.s].y -= fy;
      disp[e.t].x += fx; disp[e.t].y += fy;
    }

    // Extra attraction to cluster centres keeps clusters coherent
    const centres = [
      { x: 560, y: 270 }, { x: 160, y: 140 }, { x: 750, y: 120 },
      { x: 180, y: 430 }, { x: 750, y: 440 }, { x: 440, y: 100 },
    ];
    for (let i = 0; i < nodes.length; i++) {
      const isRing = i < 14;
      const ci = isRing ? 0 : 1 + (i % (centres.length - 1));
      const cx = centres[ci].x, cy = centres[ci].y;
      const pull = isRing ? 0.06 : 0.03;
      disp[i].x += (cx - pos[i].x) * pull;
      disp[i].y += (cy - pos[i].y) * pull;
    }

    // Apply with temperature clamping
    for (let i = 0; i < nodes.length; i++) {
      const d = Math.sqrt(disp[i].x ** 2 + disp[i].y ** 2) + 0.01;
      const scale = Math.min(d, temp) / d;
      pos[i].x += disp[i].x * scale;
      pos[i].y += disp[i].y * scale;
      // Hard boundary
      pos[i].x = Math.max(16, Math.min(W - 16, pos[i].x));
      pos[i].y = Math.max(16, Math.min(H - 16, pos[i].y));
    }
    temp *= 0.94; // cooling
  }
  return pos;
}

// ─────────────────────────────────────────────────────────────────────────────
// CURVED EDGE PATH  (quadratic bezier — looks much better than straight lines)
// ─────────────────────────────────────────────────────────────────────────────
function edgePath(x1, y1, x2, y2, curvature = 0.15) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const cx = mx - dy * curvature;
  const cy = my + dx * curvature;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCAM TIMELINE
// ─────────────────────────────────────────────────────────────────────────────
function buildScamTimeline() {
  return {
    victimId: 0,
    primaryId: 1,
    muleIds: [2, 3, 4, 5, 6, 7, 8],
    layer2Ids: [9, 10, 11, 12, 13],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE ALERT
// ─────────────────────────────────────────────────────────────────────────────
function fireVoiceAlert() {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance("Ruk jaiye. Ye transaction ek dhokha ho sakta hai. Kripya cancel dabaiye.");
  u.lang = "hi-IN"; u.rate = 0.92; u.pitch = 1.05;
  const hi = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("hi"));
  if (hi) u.voice = hi;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const GRAPH_DATA = makeGraph();
const LAYOUT_POS = runLayout(GRAPH_DATA.nodes.map(n => ({ ...n })), GRAPH_DATA.edges);
// Bake positions into nodes
GRAPH_DATA.nodes.forEach((n, i) => { n.x = LAYOUT_POS[i].x; n.y = LAYOUT_POS[i].y; });

export default function PrahaariNet() {
  const [phase, setPhase] = useState("idle");
  const [tick, setTick] = useState(0);
  const [timestamp, setTimestamp] = useState(0);
  const [flaggedIds, setFlaggedIds] = useState(new Set());
  const [fraudEdges, setFraudEdges] = useState([]);   // [{s,t}]
  const [activeEdges, setActiveEdges] = useState(new Set()); // "s-t" normal traffic
  const [particles, setParticles] = useState([]);      // fraud packet particles
  const [verdict, setVerdict] = useState(null);
  const [feed, setFeed] = useState([]);
  const [stats, setStats] = useState({ scanned: 0, flagged: 0, saved: 0 });
  const [holdCountdown, setHoldCountdown] = useState(30);
  const [showKillshot, setShowKillshot] = useState(false);
  const timeline = buildScamTimeline();
  const attackStart = useRef(null);
  const nodes = GRAPH_DATA.nodes;
  const edges = GRAPH_DATA.edges;

  // ── Animation tick ───────────────────────────────────────────────────────
  useEffect(() => {
    let id;
    const loop = () => { setTick(t => t + 1); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  // ── Attack clock ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (["idle", "saved", "blocked"].includes(phase)) { attackStart.current = null; return; }
    if (!attackStart.current) attackStart.current = performance.now();
    const id = setInterval(() => {
      if (attackStart.current) setTimestamp((performance.now() - attackStart.current) / 1000);
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  // ── Hold countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!["holding", "alerted"].includes(phase) || holdCountdown <= 0) return;
    const id = setTimeout(() => setHoldCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, holdCountdown]);

  // ── Background noise traffic ─────────────────────────────────────────────
  useEffect(() => {
    if (["injecting", "detecting", "holding", "alerted"].includes(phase)) return;
    const id = setInterval(() => {
      const a = 14 + Math.floor(Math.random() * (NODE_COUNT - 14));
      const b = 14 + Math.floor(Math.random() * (NODE_COUNT - 14));
      if (a === b) return;
      const key = `${a}-${b}`;
      setActiveEdges(p => new Set(p).add(key));
      setTimeout(() => setActiveEdges(p => { const n = new Set(p); n.delete(key); return n; }), 1400);
      const na = nodes[a], nb = nodes[b];
      const amt = Math.floor(200 + Math.random() * 30000);
      setFeed(f => [{ id: Date.now() + Math.random(), from: na.vpa, to: nb.vpa, amount: amt }, ...f.slice(0, 13)]);
      setStats(s => ({ ...s, scanned: s.scanned + 1 }));
    }, 600);
    return () => clearInterval(id);
  }, [phase]);

  // ── Particle system for fraud edges ──────────────────────────────────────
  useEffect(() => {
    if (fraudEdges.length === 0) { setParticles([]); return; }
    const id = setInterval(() => {
      setParticles(prev => {
        // Age existing
        const alive = prev.map(p => ({ ...p, t: p.t + 0.018 })).filter(p => p.t < 1);
        // Spawn new on a random fraud edge
        if (fraudEdges.length > 0 && Math.random() < 0.7) {
          const e = fraudEdges[Math.floor(Math.random() * fraudEdges.length)];
          alive.push({ id: Math.random(), edgeS: e.s, edgeT: e.t, t: 0 });
        }
        return alive;
      });
    }, 40);
    return () => clearInterval(id);
  }, [fraudEdges]);

  // ── INJECT SCAM ──────────────────────────────────────────────────────────
  const injectScam = useCallback(() => {
    if (!["idle", "saved", "blocked"].includes(phase)) return;
    setPhase("injecting");
    setTimestamp(0);
    setFlaggedIds(new Set());
    setFraudEdges([]);
    setParticles([]);
    setVerdict(null);
    setHoldCountdown(30);
    setShowKillshot(false);

    const { victimId, primaryId, muleIds, layer2Ids } = timeline;
    const pushFeed = (text, type = "sys") => setFeed(f => [{ id: Date.now() + Math.random(), text, type }, ...f.slice(0, 13)]);

    // T+0.0 — victim → primary
    pushFeed(`₹5,00,000 · grandma.kanta@hdfc → cbi.safe@upi`, "scam");
    setFraudEdges([{ s: victimId, t: primaryId }]);

    // T+0.3 — Kafka ingests
    setTimeout(() => pushFeed("⟶ txn-stream · edge written to Neo4j"), 300);

    // T+0.6 — GraphSAGE embedding
    setTimeout(() => { pushFeed("⟶ GraphSAGE · 2-hop · 23 nodes sampled"); setPhase("detecting"); }, 600);

    // T+1.0 — fan-out to mules
    setTimeout(() => {
      pushFeed("⟶ TGN · fan-out detected · 7 recipients in 47s");
      const newEdges = [{ s: victimId, t: primaryId }];
      muleIds.forEach((m, i) => {
        setTimeout(() => {
          newEdges.push({ s: primaryId, t: m });
          setFraudEdges([...newEdges]);
          setFlaggedIds(prev => new Set([...prev, primaryId, m]));
        }, i * 60);
      });
    }, 1000);

    // T+1.5 — layer2 forwards
    setTimeout(() => {
      pushFeed("⟶ IsoForest · forwarding 0.93 · velocity 14.2×");
      const allEdges = [
        { s: victimId, t: primaryId },
        ...muleIds.map(m => ({ s: primaryId, t: m })),
      ];
      layer2Ids.forEach((l, i) => {
        setTimeout(() => {
          const src = muleIds[i % muleIds.length];
          allEdges.push({ s: src, t: l });
          setFraudEdges([...allEdges]);
          setFlaggedIds(prev => new Set([...prev, l]));
        }, i * 55);
      });
    }, 1500);

    // T+1.9 — verdict
    setTimeout(() => {
      setFlaggedIds(new Set([primaryId, ...muleIds, ...layer2Ids]));
      setVerdict({ confidence: 0.94, logit: 4.21, isoScore: 0.89,
        fanIn: 7, forwardingRatio: 0.93, velocity: 14.2, window: 47, cluster: "MC-2024-0041" });
      pushFeed("⚠ GNNExplainer · MULE RING · 94% confidence", "alert");
    }, 1900);

    // T+2.2 — hold
    setTimeout(() => { setPhase("holding"); }, 2200);

    // T+2.6 — voice
    setTimeout(() => { setPhase("alerted"); fireVoiceAlert(); setStats(s => ({ ...s, flagged: s.flagged + 1 })); }, 2600);
  }, [phase]);

  const cancelTxn = () => {
    setPhase("saved");
    setStats(s => ({ ...s, saved: s.saved + 500000 }));
    setTimeout(() => setShowKillshot(true), 1600);
  };

  const reset = () => {
    setPhase("idle"); setTimestamp(0); setFlaggedIds(new Set()); setFraudEdges([]);
    setParticles([]); setVerdict(null); setHoldCountdown(30); setShowKillshot(false);
    window.speechSynthesis?.cancel();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  const isFraudEdge = (s, t) => fraudEdges.some(e => (e.s === s && e.t === t) || (e.s === t && e.t === s));
  const isActiveEdge = (s, t) => activeEdges.has(`${s}-${t}`) || activeEdges.has(`${t}-${s}`);

  const nodeColor = (n) => {
    if (flaggedIds.has(n.id)) return { fill: "#ef4444", dark: "#7f1d1d", label: "#fca5a5" };
    if (n.isVictim && phase !== "idle") return { fill: "#fbbf24", dark: "#78350f", label: "#fde68a" };
    return BANK_COLORS[n.bank] || BANK_COLORS.HDFC;
  };

  // Particle position along a bezier (approximate linear interpolation)
  const particlePos = (p) => {
    const sn = nodes[p.edgeS], tn = nodes[p.edgeT];
    if (!sn || !tn) return { x: 0, y: 0 };
    const t = p.t;
    const mx = (sn.x + tn.x) / 2 - (tn.y - sn.y) * 0.15;
    const my = (sn.y + tn.y) / 2 + (tn.x - sn.x) * 0.15;
    // Quadratic bezier point
    const x = (1 - t) * (1 - t) * sn.x + 2 * (1 - t) * t * mx + t * t * tn.x;
    const y = (1 - t) * (1 - t) * sn.y + 2 * (1 - t) * t * my + t * t * tn.y;
    return { x, y };
  };

  const pulseScale = (n) => {
    if (flaggedIds.has(n.id)) return 1 + Math.sin(tick * 0.09 + n.pulseOffset) * 0.28;
    return 1;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", background: "#06080d", color: "#fff", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

      {/* Grid bg */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(16,185,129,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,0.06) 1px,transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 50% at 55% 50%, rgba(239,68,68,0.04), transparent)", pointerEvents: "none" }} />

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid rgba(16,185,129,0.2)", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, border: "1px solid rgba(52,211,153,0.5)", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,46,22,0.5)" }}>
            <Shield size={16} color="#34d399" />
          </div>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "rgba(52,211,153,0.7)" }}>PRAHAARI·NET</div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em" }}>UPI MULE RING DETECTOR</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 9, letterSpacing: "0.2em", color: "#6b7280" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: phase === "idle" ? "#10b981" : "#f59e0b", display: "inline-block", boxShadow: `0 0 6px ${phase === "idle" ? "#10b981" : "#f59e0b"}` }} />
            T-GNN · {phase === "idle" ? "MONITORING" : phase.toUpperCase()}
          </span>
          <span>NEO4J · <span style={{ color: "#34d399" }}>LIVE</span></span>
          <span>GRAPHSAGE+TGN+ISO</span>
          <span style={{ color: "#4b5563" }}>KRAKEN'X 2026</span>
        </div>
      </div>

      {/* ── MAIN 3-COLUMN ── */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 240px", gap: 12, padding: 12, flex: 1, minHeight: 0 }}>

        {/* ── LEFT: Controls + Explainer ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>

          {/* Inject button */}
          <div style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(127,29,29,0.15)", padding: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.25em", color: "rgba(248,113,113,0.7)", marginBottom: 8 }}>DEMO TRIGGER</div>
            <button
              onClick={["idle","saved","blocked"].includes(phase) ? injectScam : undefined}
              style={{
                width: "100%", padding: "14px 0", border: `2px solid ${["idle","saved","blocked"].includes(phase) ? "#ef4444" : "#374151"}`,
                background: ["idle","saved","blocked"].includes(phase) ? "rgba(239,68,68,0.1)" : "rgba(55,65,81,0.3)",
                color: ["idle","saved","blocked"].includes(phase) ? "#f87171" : "#4b5563",
                fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em",
                cursor: ["idle","saved","blocked"].includes(phase) ? "pointer" : "not-allowed",
                outline: "none", transition: "all 0.2s",
                boxShadow: ["idle","saved","blocked"].includes(phase) ? "0 0 20px rgba(239,68,68,0.2)" : "none",
              }}>
              {phase === "idle" ? "▶  INJECT SCAM" : ["saved","blocked"].includes(phase) ? "↻  RUN AGAIN" : "DETECTING..."}
            </button>
            {["saved","blocked"].includes(phase) && (
              <button onClick={reset} style={{ width: "100%", marginTop: 6, padding: "6px 0", border: "1px solid #1f2937", background: "transparent", color: "#4b5563", fontFamily: "inherit", fontSize: 9, letterSpacing: "0.2em", cursor: "pointer", outline: "none" }}>RESET</button>
            )}
          </div>

          {/* Clock */}
          {!["idle","saved","blocked"].includes(phase) && (
            <div style={{ border: "1px solid rgba(245,158,11,0.3)", background: "rgba(120,53,15,0.15)", padding: 12 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.25em", color: "rgba(251,191,36,0.7)", marginBottom: 4 }}>ATTACK TIMELINE</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.05em" }}>
                T+{timestamp.toFixed(1)}<span style={{ fontSize: 14, color: "#d97706" }}>s</span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[["SCANNED", stats.scanned.toLocaleString(), "#34d399"],
              ["FLAGGED", stats.flagged, "#f87171"],
              ["SAVED ₹", `${(stats.saved/100000).toFixed(1)}L`, "#fbbf24"]].map(([label, val, color]) => (
              <div key={label} style={{ border: "1px solid #1f2937", padding: "8px 6px" }}>
                <div style={{ fontSize: 8, letterSpacing: "0.2em", color: "#6b7280" }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Explainer / idle info */}
          <div style={{ border: `1px solid ${verdict ? "rgba(52,211,153,0.4)" : "#1f2937"}`, background: verdict ? "rgba(5,46,22,0.2)" : "transparent", padding: 14, flex: 1, overflow: "auto" }}>
            {verdict ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <AlertTriangle size={12} color="#f87171" />
                  <span style={{ fontSize: 9, letterSpacing: "0.25em", color: "#f87171" }}>GNN·EXPLAINER · VERDICT</span>
                </div>
                <div style={{ fontSize: 10, color: "#d1fae5", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div><span style={{ color: "#f87171", fontWeight: 700 }}>FLAGGED</span> · ₹5,00,000<br /><span style={{ color: "#6ee7b7" }}>cbi.safe@upi</span></div>
                  {[
                    ["fan-in velocity", `${verdict.velocity}× normal`],
                    ["forwarding ratio", `${verdict.forwardingRatio} (≥0.7)`],
                    ["fan-out nodes", `${verdict.fanIn} VPAs`],
                    ["time window", `${verdict.window}s`],
                    ["I4C cluster", verdict.cluster],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", borderLeft: "2px solid rgba(52,211,153,0.3)", paddingLeft: 8 }}>
                      <span style={{ color: "#6b7280" }}>{k}</span>
                      <span style={{ color: "#fbbf24" }}>{v}</span>
                    </div>
                  ))}
                  {[["GraphSAGE logit", verdict.logit],["IsoForest score", verdict.isoScore]].map(([k,v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#4b5563", fontSize: 9 }}>{k}</span>
                      <span style={{ color: "#6b7280", fontSize: 9 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid rgba(52,211,153,0.2)", paddingTop: 8 }}>
                    <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.2em", marginBottom: 6 }}>CONFIDENCE</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: "#0f172a" }}>
                        <div style={{ height: "100%", width: `${verdict.confidence * 100}%`, background: "linear-gradient(90deg,#f59e0b,#ef4444)", transition: "width 0.8s ease" }} />
                      </div>
                      <span style={{ color: "#f87171", fontWeight: 700, fontSize: 14 }}>{Math.round(verdict.confidence * 100)}%</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 9, letterSpacing: "0.25em", color: "#374151", marginBottom: 12 }}>SYSTEM · IDLE</div>
                <div style={{ fontSize: 10, color: "#4b5563", lineHeight: 1.8 }}>
                  <p>Monitoring <span style={{ color: "#34d399" }}>{NODE_COUNT}</span> VPA nodes across <span style={{ color: "#34d399" }}>6</span> banks.</p>
                  <p style={{ marginTop: 8 }}>GNN stack:<br /><span style={{ color: "#9ca3af" }}>GraphSAGE → TGN/TGAT → IsoForest → GNNExplainer</span></p>
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4, fontSize: 9, color: "#374151" }}>
                    <span>✓ Elliptic · 203K nodes · AUROC 0.96</span>
                    <span>✓ IEEE-CIS · 590K transactions</span>
                    <span>✓ Neo4j · GDS · 2-hop traversal</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bank legend */}
          <div style={{ border: "1px solid #1f2937", padding: 10 }}>
            <div style={{ fontSize: 8, letterSpacing: "0.2em", color: "#374151", marginBottom: 7 }}>BANK LEGEND</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px" }}>
              {BANKS.map(b => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "#6b7280" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: BANK_COLORS[b].fill, boxShadow: `0 0 5px ${BANK_COLORS[b].fill}` }} />
                  {b}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CENTRE: GRAPH ── */}
        <div style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          {/* graph header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.4)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9, letterSpacing: "0.2em", color: "#4b5563" }}>
              <Network size={12} color="#34d399" />
              UPI · INTER-BANK TRANSACTION GRAPH
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 9, color: "#4b5563" }}>
              {[["●", "#34d399", "Normal"], ["●", "#fbbf24", "Victim"], ["●", "#ef4444", "Mule"]].map(([dot, col, lbl]) => (
                <span key={lbl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: col, fontSize: 12 }}>{dot}</span>{lbl}
                </span>
              ))}
            </div>
          </div>

          {/* SVG */}
          <div style={{ flex: 1, position: "relative" }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
              <defs>
                {/* Per-bank gradients */}
                {BANKS.map(b => (
                  <radialGradient key={b} id={`grad-${b}`} cx="40%" cy="35%" r="60%">
                    <stop offset="0%" stopColor={BANK_COLORS[b].fill} stopOpacity="1" />
                    <stop offset="100%" stopColor={BANK_COLORS[b].dark} stopOpacity="0.7" />
                  </radialGradient>
                ))}
                <radialGradient id="grad-FLAGGED" cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="1" />
                  <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.8" />
                </radialGradient>
                <radialGradient id="grad-VICTIM" cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                  <stop offset="100%" stopColor="#78350f" stopOpacity="0.8" />
                </radialGradient>
                {/* Glow filters */}
                <filter id="glow-soft" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-red" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="5" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-amber" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                {/* Arrowhead markers */}
                <marker id="arrow-normal" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#1f2937" />
                </marker>
                <marker id="arrow-active" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#10b981" />
                </marker>
                <marker id="arrow-fraud" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
                </marker>
              </defs>

              {/* ── Background edges ── */}
              {edges.map((e, i) => {
                const sn = nodes[e.s], tn = nodes[e.t];
                const active = isActiveEdge(e.s, e.t);
                const fraud = isFraudEdge(e.s, e.t);
                if (fraud) return null; // drawn separately below
                return (
                  <path key={i}
                    d={edgePath(sn.x, sn.y, tn.x, tn.y, active ? 0.18 : 0.12)}
                    fill="none"
                    stroke={active ? "#10b981" : "#1a2035"}
                    strokeWidth={active ? 1.3 : 0.5}
                    opacity={active ? 0.8 : 0.4}
                    markerEnd={active ? "url(#arrow-active)" : "url(#arrow-normal)"}
                  />
                );
              })}

              {/* ── Fraud edges — drawn on top, glowing ── */}
              {fraudEdges.map((e, i) => {
                const sn = nodes[e.s], tn = nodes[e.t];
                return (
                  <g key={`fe-${i}`}>
                    {/* Thick glow halo */}
                    <path d={edgePath(sn.x, sn.y, tn.x, tn.y, 0.18)}
                      fill="none" stroke="#ef4444" strokeWidth="5" opacity="0.15"
                      style={{ filter: "blur(4px)" }} />
                    {/* Main fraud edge */}
                    <path d={edgePath(sn.x, sn.y, tn.x, tn.y, 0.18)}
                      fill="none" stroke="#ef4444" strokeWidth="1.8" opacity="0.95"
                      markerEnd="url(#arrow-fraud)" style={{ filter: "url(#glow-red)" }} />
                  </g>
                );
              })}

              {/* ── Particles along fraud edges ── */}
              {particles.map(p => {
                const pos = particlePos(p);
                const alpha = p.t < 0.15 ? p.t / 0.15 : p.t > 0.8 ? (1 - p.t) / 0.2 : 1;
                return (
                  <circle key={p.id} cx={pos.x} cy={pos.y} r={2.5}
                    fill="#fca5a5" opacity={alpha * 0.9}
                    style={{ filter: "url(#glow-red)" }} />
                );
              })}

              {/* ── Nodes ── */}
              {nodes.map(n => {
                const isFlagged = flaggedIds.has(n.id);
                const isVictim = n.isVictim && phase !== "idle";
                const isPrimary = n.isPrimaryRecv && phase !== "idle";
                const ps = pulseScale(n);
                const colors = isFlagged ? { fill: "#ef4444", dark: "#7f1d1d", label: "#fca5a5" }
                             : isVictim ? { fill: "#fbbf24", dark: "#78350f", label: "#fde68a" }
                             : BANK_COLORS[n.bank] || BANK_COLORS.HDFC;
                const gradId = isFlagged ? "grad-FLAGGED" : isVictim ? "grad-VICTIM" : `grad-${n.bank}`;
                const nr = n.r * ps;
                const glowFilter = isFlagged ? "url(#glow-red)" : isVictim ? "url(#glow-amber)" : "url(#glow-soft)";

                return (
                  <g key={n.id} style={{ cursor: "default" }}>
                    {/* Outer ring for special nodes */}
                    {(isFlagged || isVictim || isPrimary) && (
                      <circle cx={n.x} cy={n.y}
                        r={nr * 2.2 + (isFlagged ? Math.sin(tick * 0.07 + n.pulseOffset) * 3 : 0)}
                        fill="none"
                        stroke={isFlagged ? "#ef4444" : "#fbbf24"}
                        strokeWidth="0.7"
                        opacity={isFlagged ? 0.35 : 0.5}
                      />
                    )}
                    {/* Second outer ring — flagged only */}
                    {isFlagged && (
                      <circle cx={n.x} cy={n.y}
                        r={nr * 3.5 + Math.sin(tick * 0.05 + n.pulseOffset + 1) * 4}
                        fill="none" stroke="#ef4444" strokeWidth="0.3" opacity="0.15"
                      />
                    )}
                    {/* Main node */}
                    <circle cx={n.x} cy={n.y} r={nr}
                      fill={`url(#${gradId})`}
                      stroke={colors.fill} strokeWidth="0.6"
                      style={{ filter: glowFilter }}
                    />
                    {/* Label for key nodes */}
                    {(isVictim || isPrimary) && (
                      <text x={n.x} y={n.y - nr - 5}
                        fill={colors.label} fontSize="8" textAnchor="middle"
                        fontWeight="bold" fontFamily="inherit" style={{ filter: glowFilter }}>
                        {isVictim ? "VICTIM" : "cbi.safe@upi"}
                      </text>
                    )}
                    {/* Mule label */}
                    {isFlagged && !isVictim && !isPrimary && nr > 5 && (
                      <text x={n.x} y={n.y + 1} fill="white" fontSize="5.5"
                        textAnchor="middle" dominantBaseline="middle" opacity="0.6" fontFamily="inherit">
                        MULE
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Phase overlay — corner badge */}
              {phase === "alerted" && (
                <g>
                  <rect x={W - 140} y={12} width={126} height={44} fill="rgba(127,29,29,0.9)" stroke="#ef4444" strokeWidth="1" />
                  <text x={W - 77} y={28} fill="#fca5a5" fontSize="8" textAnchor="middle" fontFamily="inherit" letterSpacing="2">TRANSACTION · HELD</text>
                  <text x={W - 77} y={48} fill="#f87171" fontSize="22" textAnchor="middle" fontFamily="inherit" fontWeight="700">{holdCountdown}s</text>
                </g>
              )}
              {phase === "saved" && (
                <g>
                  <rect x={W - 130} y={12} width={116} height={44} fill="rgba(5,46,22,0.9)" stroke="#10b981" strokeWidth="1" />
                  <text x={W - 72} y={28} fill="#6ee7b7" fontSize="8" textAnchor="middle" fontFamily="inherit" letterSpacing="2">MONEY · SAVED</text>
                  <text x={W - 72} y={48} fill="#34d399" fontSize="15" textAnchor="middle" fontFamily="inherit" fontWeight="700">₹5,00,000</text>
                </g>
              )}
            </svg>
          </div>

          {/* bottom bar */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 9, color: "#374151", flexShrink: 0 }}>
            <span>nodes <span style={{ color: "#9ca3af" }}>{nodes.length}</span> · edges <span style={{ color: "#9ca3af" }}>{edges.length}</span></span>
            <span>inference <span style={{ color: "#34d399" }}>~47ms</span> · k-hop <span style={{ color: "#34d399" }}>2</span></span>
            <span style={{ color: "#1f2937" }}>FR layout · full N² · 160 iter</span>
          </div>
        </div>

        {/* ── RIGHT: Phone + Feed ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          {/* Phone */}
          <div style={{ border: "1px solid #1f2937", background: "linear-gradient(180deg,#111827,#060810)", padding: 14, flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 9, letterSpacing: "0.2em" }}>
              <span style={{ color: "#4b5563", display: "flex", alignItems: "center", gap: 5 }}><Phone size={10} /> VICTIM · PHONE</span>
              <span style={{ color: "#374151" }}>+91 98···4712</span>
            </div>
            <div style={{ border: "1px solid #1f2937", borderRadius: 8, background: "#000", padding: 12, minHeight: 195 }}>
              {phase === "idle" && (
                <div style={{ textAlign: "center", paddingTop: 28, color: "#374151", fontSize: 10 }}>
                  <div style={{ marginBottom: 4, letterSpacing: "0.2em", fontSize: 9 }}>HDFC UPI</div>
                  <div>Balance: ₹5,47,200</div>
                  <div style={{ marginTop: 24, fontSize: 9, color: "#1f2937" }}>No active transaction</div>
                </div>
              )}
              {["injecting","detecting","holding"].includes(phase) && (
                <div style={{ fontSize: 10 }}>
                  <div style={{ color: "#f59e0b", letterSpacing: "0.2em", fontSize: 8, marginBottom: 6 }}>OUTGOING · PROCESSING</div>
                  <div style={{ color: "#9ca3af", marginBottom: 2 }}>To: <span style={{ color: "#fff" }}>cbi.safe@upi</span></div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", margin: "6px 0" }}>₹5,00,000</div>
                  <div style={{ color: "#4b5563", fontSize: 9, marginBottom: 10 }}>Note: "Safe account custody"</div>
                  <div style={{ height: 3, background: "#1f2937" }}>
                    <div style={{ height: "100%", width: "55%", background: "#f59e0b", animation: "pulse 1s ease-in-out infinite" }} />
                  </div>
                </div>
              )}
              {phase === "alerted" && (
                <div style={{ fontSize: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <AlertTriangle size={12} color="#fff" />
                    </div>
                    <span style={{ color: "#f87171", letterSpacing: "0.15em", fontSize: 8 }}>PRAHAARI·NET ALERT</span>
                  </div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>रुक जाइए!</div>
                  <div style={{ color: "#d1d5db", fontSize: 9, lineHeight: 1.6, marginBottom: 8 }}>
                    Ye transaction ek <span style={{ color: "#f87171" }}>dhokha</span> ho sakta hai.<br />
                    Paisa 7 alag accounts mein ja raha hai.
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 8, color: "#4b5563", marginBottom: 8 }}>
                    <Volume2 size={10} color="#34d399" /> Voice alert · Hindi · Bhashini
                  </div>
                  <div style={{ fontSize: 9, color: "#fbbf24", marginBottom: 10 }}>⏱ Held for {holdCountdown}s</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <button onClick={cancelTxn} style={{ padding: "9px 0", border: "2px solid #10b981", background: "#10b981", color: "#000", fontWeight: 700, fontSize: 10, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.1em" }}>CANCEL</button>
                    <button disabled style={{ padding: "9px 0", border: "1px solid #1f2937", background: "transparent", color: "#374151", fontSize: 10, fontFamily: "inherit", cursor: "not-allowed" }}>PROCEED</button>
                  </div>
                </div>
              )}
              {phase === "saved" && (
                <div style={{ textAlign: "center", paddingTop: 16 }}>
                  <CheckCircle2 size={36} color="#10b981" style={{ margin: "0 auto 8px" }} />
                  <div style={{ color: "#34d399", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", marginBottom: 4 }}>CANCELLED</div>
                  <div style={{ color: "#4b5563", fontSize: 9, marginBottom: 10 }}>Your money is safe.</div>
                  <div style={{ border: "1px solid rgba(16,185,129,0.3)", background: "rgba(5,46,22,0.4)", padding: 8 }}>
                    <div style={{ fontSize: 8, color: "#4b5563", marginBottom: 2 }}>Balance retained</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#34d399" }}>₹5,47,200</div>
                  </div>
                </div>
              )}
              {phase === "blocked" && (
                <div style={{ textAlign: "center", paddingTop: 16 }}>
                  <XCircle size={36} color="#ef4444" style={{ margin: "0 auto 8px" }} />
                  <div style={{ color: "#f87171", fontWeight: 700, fontSize: 11, marginBottom: 4 }}>HOLD EXPIRED</div>
                  <div style={{ color: "#4b5563", fontSize: 9 }}>Escalated to I4C</div>
                </div>
              )}
            </div>
          </div>

          {/* Live feed */}
          <div style={{ border: "1px solid #1f2937", background: "rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div style={{ padding: "7px 12px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 6, fontSize: 9, letterSpacing: "0.2em", color: "#4b5563", flexShrink: 0 }}>
              <Activity size={10} color="#34d399" /> LIVE · txn-stream
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 6, display: "flex", flexDirection: "column", gap: 3 }}>
              {feed.map(item => (
                <div key={item.id} style={{
                  padding: "4px 8px", fontSize: 9, borderLeft: `2px solid ${item.type === "alert" ? "#ef4444" : item.type === "scam" ? "#ef4444" : item.type === "saved" ? "#10b981" : "#1f2937"}`,
                  background: item.type === "alert" ? "rgba(127,29,29,0.25)" : item.type === "scam" ? "rgba(127,29,29,0.15)" : "transparent",
                  color: item.type === "alert" ? "#fca5a5" : item.type === "scam" ? "#fca5a5" : item.type === "saved" ? "#6ee7b7" : "#4b5563",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {item.text || (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "#6b7280", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block" }}>{item.from?.split("@")[0]}</span>
                      <ArrowRight size={8} color="#374151" />
                      <span style={{ color: "#9ca3af" }}>{item.to?.split("@")[0]}</span>
                      <span style={{ marginLeft: "auto", color: "#34d399" }}>₹{item.amount >= 100000 ? `${(item.amount/100000).toFixed(1)}L` : item.amount?.toLocaleString("en-IN")}</span>
                    </span>
                  )}
                </div>
              ))}
              {feed.length === 0 && <div style={{ color: "#1f2937", fontSize: 9, textAlign: "center", paddingTop: 24 }}>Waiting...</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ── KILLSHOT MODAL ── */}
      {showKillshot && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.96)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{ maxWidth: 780, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.4em", color: "#34d399", marginBottom: 8 }}>THE KILL SHOT</div>
            <div style={{ width: 48, height: 1, background: "#34d399", margin: "0 auto 32px" }} />
            <div style={{ fontSize: "clamp(20px,3.5vw,36px)", fontWeight: 700, lineHeight: 1.4, marginBottom: 36 }}>
              RBI's MuleHunter.AI detects fraud<br />within <span style={{ color: "#374151" }}>a single bank.</span><br />
              <span style={{ color: "#34d399" }}>PrahaariNet</span> detects mule rings across<br />India's <span style={{ color: "#34d399" }}>entire UPI graph.</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 36 }}>
              {[["520M+", "UPI USERS"], ["19B", "TXNS / MONTH"], ["1", "GRAPH"]].map(([n, l]) => (
                <div key={l} style={{ border: "1px solid rgba(52,211,153,0.2)", background: "rgba(5,46,22,0.15)", padding: 24 }}>
                  <div style={{ fontSize: 36, fontWeight: 700, color: "#34d399" }}>{n}</div>
                  <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#4b5563", marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid #1f2937", paddingTop: 24, color: "#6b7280", fontSize: 13 }}>
              We are asking for <span style={{ color: "#fbbf24", fontWeight: 700 }}>₹40,000</span> in prize money to prevent <span style={{ color: "#f87171", fontWeight: 700 }}>₹22,495 crore</span> in losses.
              <div style={{ fontSize: 9, color: "#374151", letterSpacing: "0.2em", marginTop: 6 }}>WE THINK THAT IS A REASONABLE EXCHANGE RATE.</div>
            </div>
            <button onClick={() => { setShowKillshot(false); reset(); }}
              style={{ marginTop: 28, padding: "10px 28px", border: "1px solid #34d399", background: "transparent", color: "#34d399", fontFamily: "inherit", fontSize: 10, letterSpacing: "0.2em", cursor: "pointer", transition: "all 0.2s" }}>
              ↺ RUN DEMO AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
