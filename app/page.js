'use client';

import { useState } from 'react';

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function Home() {
  const [sentence, setSentence] = useState('');
  const [result, setResult] = useState({ amount: 0, people: 0, each: 0 });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const text = sentence.trim();
    if (!text) return;

    setLoading(true);
    setResult({ amount: 0, people: 0, each: 0 });

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      setResult({
        amount: Number(data.amount || 0),
        people: Number(data.people || 0),
        each: Number(data.each || 0),
      });
    } catch {
      setResult({ amount: 0, people: 0, each: 0 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.brand}>
            <div style={styles.logo}>S</div>
            <div style={styles.title}>SplitSmart</div>
          </div>
          <div style={styles.groupPill}>AI Split</div>
        </div>

        <div style={styles.addRow}>
          <input
            style={styles.input}
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Dinner was 1800 and we split it 4 ways"
            aria-label="Sentence to parse"
          />
          <button style={styles.addBtn} onClick={handleSubmit} aria-label="Parse sentence" disabled={loading}>
            {loading ? '…' : '→'}
          </button>
        </div>

        <div style={styles.resultWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Field</th>
                <th style={styles.th}>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={styles.td}>Amount</td>
                <td style={styles.td}>{formatMoney(result.amount)}</td>
              </tr>
              <tr>
                <td style={styles.td}>People</td>
                <td style={styles.td}>{result.people}</td>
              </tr>
              <tr>
                <td style={styles.td}>Each</td>
                <td style={styles.td}>{formatMoney(result.each)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '28px 16px 48px',
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    background: 'var(--card)',
    borderRadius: 24,
    boxShadow: '0 24px 60px -24px rgba(13,27,62,.28)',
    border: '1px solid var(--line)',
    padding: 20,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: {
    width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center',
    color: '#fff', fontWeight: 800, fontSize: 18,
    background: 'linear-gradient(135deg, var(--blue), var(--cyan))',
    boxShadow: '0 8px 18px -6px rgba(28,95,212,.55)',
  },
  title: { fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' },
  groupPill: {
    fontSize: 12.5, fontWeight: 800, color: 'var(--blue)',
    background: 'rgba(28,95,212,.1)', padding: '6px 12px', borderRadius: 999,
  },
  addRow: { display: 'flex', gap: 10, marginBottom: 16 },
  input: {
    flex: 1, border: '1px solid var(--line)', borderRadius: 14, padding: '13px 15px',
    fontSize: 15, outline: 'none', background: '#f7f9fc', color: 'var(--ink)',
  },
  addBtn: {
    flex: 'none', width: 48, borderRadius: 14, border: 'none', color: '#fff', fontSize: 24, fontWeight: 700,
    background: 'linear-gradient(135deg, var(--blue), var(--cyan))',
    boxShadow: '0 10px 22px -8px rgba(28,95,212,.6)',
    opacity: 1,
  },
  resultWrap: {
    border: '1px solid var(--line)',
    borderRadius: 16,
    background: '#f7f9fc',
    padding: 12,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '1px solid var(--line)',
    color: 'var(--muted)',
    fontSize: 13,
    fontWeight: 700,
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid var(--line)',
    fontWeight: 600,
    color: 'var(--ink)',
  },
};
