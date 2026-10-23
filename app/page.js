'use client';

import { useState } from 'react';

const defaultResult = { amount: 1800, people: 4, each: 450 };

const examples = [
  'Dinner was 1800 and we split it 4 ways',
  'Movie night was 1200 and we split it among 6 of us',
  'Cab bill came to 600 for 3 friends',
];

const formatMoney = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function Home() {
  const [sentence, setSentence] = useState(examples[0]);
  const [result, setResult] = useState(defaultResult);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const text = sentence.trim();
    if (!text) {
      setError('Please enter a sentence to split.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      if (!response.ok || !data) {
        throw new Error(data?.error || 'Split parsing failed');
      }

      setResult({
        amount: Number(data.amount || 0),
        people: Number(data.people || 0),
        each: Number(data.each || 0),
      });
    } catch (err) {
      setError(err.message || 'Unable to parse the sentence.');
      setResult({ amount: 0, people: 0, each: 0 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>SmartSplit dashboard</div>
            <h1 style={styles.title}>Group expense overview</h1>
          </div>
          <div style={styles.badge}>Live</div>
        </header>

        <section style={styles.summaryGrid}>
          <div style={styles.cardSummary}>
            <div style={styles.cardLabel}>Total bill</div>
            <div style={styles.cardValue}>{formatMoney(result.amount)}</div>
          </div>
          <div style={styles.cardSummary}>
            <div style={styles.cardLabel}>People</div>
            <div style={styles.cardValue}>{result.people}</div>
          </div>
          <div style={styles.cardSummary}>
            <div style={styles.cardLabel}>Each pays</div>
            <div style={styles.cardValue}>{formatMoney(result.each)}</div>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>Ask SmartSplit</div>
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Dinner was 1800 and we split it 4 ways"
              aria-label="Split sentence"
            />
            <button style={styles.button} onClick={handleSubmit} disabled={loading}>
              {loading ? 'Parsing...' : 'Split it'}
            </button>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.examplesRow}>
            {examples.map((example) => (
              <button key={example} style={styles.exampleChip} onClick={() => setSentence(example)}>
                {example}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>Split result</div>
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
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #eef4ff 0%, #f8fafc 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    color: '#0f172a',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  shell: {
    width: '100%',
    maxWidth: 980,
    display: 'grid',
    gap: 18,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#4567d8',
  },
  title: {
    margin: '8px 0 0',
    fontSize: 'clamp(2rem, 5vw, 2.8rem)',
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
  },
  badge: {
    background: '#dbeafe',
    color: '#1d4ed8',
    border: '1px solid rgba(29,78,216,0.2)',
    borderRadius: 999,
    padding: '8px 12px',
    fontWeight: 700,
    fontSize: 12,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
  },
  cardSummary: {
    background: '#ffffff',
    border: '1px solid #dfe8f7',
    borderRadius: 20,
    boxShadow: '0 18px 40px -24px rgba(15, 23, 42, 0.35)',
    padding: 20,
  },
  cardLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  cardValue: {
    marginTop: 12,
    fontSize: 'clamp(1.7rem, 3vw, 2.5rem)',
    fontWeight: 800,
    letterSpacing: '-0.05em',
  },
  panel: {
    background: '#ffffff',
    border: '1px solid #dfe8f7',
    borderRadius: 22,
    boxShadow: '0 18px 40px -24px rgba(15, 23, 42, 0.35)',
    padding: 20,
  },
  panelHeader: {
    fontWeight: 800,
    marginBottom: 16,
    fontSize: 18,
  },
  inputRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  input: {
    flex: 1,
    minWidth: 220,
    padding: '15px 16px',
    borderRadius: 14,
    border: '1px solid #dbe3f1',
    background: '#f8fafc',
    fontSize: 15,
    outline: 'none',
    color: '#0f172a',
  },
  button: {
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: 15,
    padding: '15px 22px',
    cursor: 'pointer',
    boxShadow: '0 16px 30px -20px rgba(37,99,235,0.9)',
  },
  error: {
    marginTop: 12,
    color: '#b91c1c',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: 14,
  },
  examplesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  exampleChip: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 4,
  },
  th: {
    textAlign: 'left',
    padding: '12px 8px',
    borderBottom: '1px solid #e2e8f0',
    color: '#64748b',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  td: {
    padding: '16px 8px',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: 700,
    fontSize: 16,
  },
};
