    'use client';
import { useState } from 'react';

export default function Home() {
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('healthcare');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, theme }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) { console.error("Ensure Python server is running on port 8000"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-mono">
      <div className="max-w-2xl mx-auto border border-slate-800 p-8 rounded-2xl bg-slate-900/50">
        <h1 className="text-3xl font-black text-cyan-400 mb-6 uppercase tracking-widest">Nexus Core Engine</h1>
        <select value={theme} onChange={(e)=>setTheme(e.target.value)} className="w-full p-3 mb-4 bg-slate-800 border border-slate-700 rounded">
          <option value="healthcare">Healthcare / Triage</option>
          <option value="agriculture">Agriculture / Disease</option>
          <option value="neuro">Neurodivergent Support</option>
        </select>
        <textarea value={query} onChange={(e)=>setQuery(e.target.value)} className="w-full p-4 bg-slate-800 border border-slate-700 rounded h-32 mb-4" placeholder="Input system data..."/>
        <button onClick={handleAnalyze} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 font-bold rounded shadow-lg shadow-cyan-900/20">
          {loading ? 'ANALYZING...' : 'RUN AI INFERENCE'}
        </button>
        {result && (
          <div className="mt-8 p-6 bg-slate-800 rounded border-l-4 border-cyan-400">
            <p className="text-cyan-400 font-bold mb-2">RESULT: {result.risk_score}/100</p>
            <p className="text-slate-300">{result.ai_insight}</p>
          </div>
        )}
      </div>
    </div>
  );
}