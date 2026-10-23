'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const STORAGE_KEY = 'splitsmart.groups.v1';
const CURRENT_GROUP_KEY = 'splitsmart.currentGroupId';
const AUTH_KEY = 'splitsmart.auth.user.v1';
const USERS_KEY = 'splitsmart.users.v1';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const defaultResult = { amount: 0, people: 0, each: 0 };
const examples = [
  'Dinner was 1800 and we split it 4 ways',
  'Movie night was 1200 and we split it among 6 of us',
  'Cab bill came to 600 for 3 friends',
];

const formatMoney = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const generateJoinCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function parseExpenseText(text, groupId, paidByUser = '') {
  const cleaned = String(text || '').trim();
  if (!cleaned) return null;

  const result = {
    id: createId('exp'),
    group_id: groupId,
    emoji: '🧾',
    name: 'Expense',
    paidBy: paidByUser || 'Unknown',
    amount: 0,
  };

  const amountMatch = cleaned.match(/\$?(\d+(?:,\d{3})*(?:\.\d+)?)/);
  const amountValue = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : 0;
  result.amount = amountValue;

  const nameText = cleaned.replace(amountMatch?.[0] || '', '').replace(/\s+/g, ' ').trim();
  result.name = nameText || 'Expense';

  return result;
}

function buildDefaultGroups() {
  return [
    {
      id: 'group-default',
      name: 'My Group',
      join_code: 'MYGRP1',
      members: ['demo@local.test'],
      expenses: [
        { id: 'seed-1', group_id: 'group-default', emoji: '🍽️', name: 'Dinner', paidBy: 'aisha@example.com', amount: 1800 },
        { id: 'seed-2', group_id: 'group-default', emoji: '🚕', name: 'Cab', paidBy: 'raj@example.com', amount: 400 },
      ],
    },
  ];
}

export default function Home() {
  const [groups, setGroups] = useState([]);
  const [currentGroupId, setCurrentGroupId] = useState('');
  const [groupNameInput, setGroupNameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [authInput, setAuthInput] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [sentence, setSentence] = useState(examples[0]);
  const [result, setResult] = useState(defaultResult);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(AUTH_KEY) || '';
      const cleanUser = normalizeEmail(savedUser);
      setCurrentUser(cleanUser);
      setAuthInput(cleanUser);

      const savedGroups = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      const savedCurrentId = localStorage.getItem(CURRENT_GROUP_KEY) || '';

      if (savedGroups && savedGroups.length > 0) {
        setGroups(savedGroups);
        setCurrentGroupId(savedCurrentId || savedGroups[0].id);
      } else {
        const initialGroups = buildDefaultGroups();
        setGroups(initialGroups);
        setCurrentGroupId(initialGroups[0].id);
      }
    } catch {
      const initialGroups = buildDefaultGroups();
      setGroups(initialGroups);
      setCurrentGroupId(initialGroups[0].id);
    }
  }, []);

  useEffect(() => {
    if (groups.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
      if (!currentGroupId || !groups.some((group) => group.id === currentGroupId)) {
        setCurrentGroupId(groups[0].id);
      }
    }
  }, [groups, currentGroupId]);

  useEffect(() => {
    if (currentGroupId) {
      localStorage.setItem(CURRENT_GROUP_KEY, currentGroupId);
    }
  }, [currentGroupId]);

  useEffect(() => {
    localStorage.setItem(AUTH_KEY, currentUser);
  }, [currentUser]);

  const currentGroup = useMemo(
    () => groups.find((group) => group.id === currentGroupId) || groups[0] || null,
    [groups, currentGroupId],
  );

  const visibleExpenses = useMemo(() => {
    if (!currentGroup) return [];
    return (currentGroup.expenses || []).filter((expense) => {
      if (!expense.group_id) return true;
      return expense.group_id === currentGroup.id;
    });
  }, [currentGroup]);

  useEffect(() => {
    if (!visibleExpenses.length) {
      setResult(defaultResult);
      return;
    }

    const total = visibleExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const people = Math.max(1, currentGroup?.members?.length || 1);
    setResult({
      amount: total,
      people,
      each: Number((total / people).toFixed(2)),
    });
  }, [visibleExpenses, currentGroup]);

  const ensureUserRecord = (email) => {
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    try {
      const existingUsers = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const userExists = existingUsers.some((user) => normalizeEmail(user.email) === normalized);

      if (!userExists) {
        const nextUsers = [...existingUsers, { id: createId('user'), email: normalized, createdAt: new Date().toISOString() }];
        localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
      }
    } catch {
      const nextUsers = [{ id: createId('user'), email: normalized, createdAt: new Date().toISOString() }];
      localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
    }

    return normalized;
  };

  const loginAsUser = () => {
    try {
      const nextUser = ensureUserRecord(authInput);
      setCurrentUser(nextUser);
      setAuthInput(nextUser);
      localStorage.setItem(AUTH_KEY, nextUser);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to log in with that email.');
    }
  };

  const logoutUser = () => {
    setCurrentUser('');
    setAuthInput('');
    localStorage.removeItem(AUTH_KEY);
    setError('');
  };

  const createGroup = () => {
    const name = groupNameInput.trim();
    if (!currentUser) {
      setError('Login with an email before creating a group.');
      return;
    }
    if (!name) return;

    const newGroup = {
      id: createId('group'),
      name,
      join_code: generateJoinCode(),
      members: currentUser ? [currentUser] : [],
      expenses: [],
    };

    setGroups((list) => [...list, newGroup]);
    setCurrentGroupId(newGroup.id);
    setGroupNameInput('');
  };

  const joinGroupByCode = async () => {
    const code = joinCodeInput.trim();
    if (!currentUser) {
      setError('Login with an email before joining a group.');
      return;
    }
    if (!code) {
      setError('Enter a join code to join a group.');
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('join_group', { code });

      if (rpcError) {
        throw new Error(rpcError.message || 'Unable to join that group.');
      }

      const joinedId = typeof data === 'string' ? data : null;
      const normalizedCode = code.toUpperCase();
      const existingGroup = groups.find((group) => group.join_code === normalizedCode || group.id === joinedId);

      if (existingGroup) {
        setGroups((list) =>
          list.map((group) =>
            group.id === existingGroup.id
              ? {
                  ...group,
                  members: Array.from(new Set([...(group.members || []), currentUser || 'friend@demo.test'])),
                }
              : group,
          ),
        );
        setCurrentGroupId(existingGroup.id);
      } else if (joinedId) {
        const joinedGroup = {
          id: joinedId,
          name: 'Joined Group',
          join_code: normalizedCode,
          members: [currentUser || 'friend@demo.test'],
          expenses: [],
        };
        setGroups((list) => [...list, joinedGroup]);
        setCurrentGroupId(joinedId);
      }

      setJoinCodeInput('');
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to join group with that code.');
    }
  };

  const handleSubmit = async () => {
    const text = sentence.trim();
    if (!currentUser) {
      setError('Login with an email before adding an expense.');
      return;
    }
    if (!text || !currentGroup) return;

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
        throw new Error(data?.error || 'Could not parse the expense.');
      }

      const parsed = parseExpenseText(text, currentGroup.id, currentUser);
      const parsedAmount = Number(data.amount || parsed?.amount || 0);
      const parsedPeople = Number(data.people || currentGroup.members.length || 1);
      const parsedEach = Number(data.each || (parsedPeople > 0 ? parsedAmount / parsedPeople : 0));

      const expense = {
        ...(parsed || {
          id: createId('exp'),
          group_id: currentGroup.id,
          emoji: '🧾',
          name: 'Expense',
          paidBy: currentUser,
          amount: parsedAmount,
        }),
        amount: parsedAmount,
        paidBy: currentUser,
        group_id: currentGroup.id,
      };

      setGroups((list) =>
        list.map((group) =>
          group.id === currentGroup.id
            ? {
                ...group,
                expenses: [...group.expenses, expense],
                members: Array.from(new Set([...(group.members || []), currentUser])),
              }
            : group,
        ),
      );

      setSentence('');
      setResult({ amount: parsedAmount, people: parsedPeople, each: parsedEach });
    } catch (err) {
      setError(err.message || 'Unable to parse expense.');
    } finally {
      setLoading(false);
    }
  };

  const removeExpense = (expenseId) => {
    if (!currentGroup) return;
    setGroups((list) =>
      list.map((group) =>
        group.id === currentGroup.id
          ? { ...group, expenses: group.expenses.filter((expense) => expense.id !== expenseId) }
          : group,
      ),
    );
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
          <div style={styles.panelHeader}>Email login</div>
          <div style={styles.authCard}>
            <div style={styles.authRow}>
              <div>
                <div style={styles.panelSubLabel}>Logged in as</div>
                <div style={styles.userBadge}>{currentUser || 'No one logged in'}</div>
              </div>
              <button style={styles.buttonGhost} onClick={logoutUser}>Log out</button>
            </div>
            <div style={styles.groupCreateRow}>
              <input
                style={styles.input}
                value={authInput}
                onChange={(event) => setAuthInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && loginAsUser()}
                placeholder="Enter email address"
                aria-label="Email address"
                type="email"
              />
              <button style={styles.buttonGhost} onClick={loginAsUser}>Login</button>
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>Your groups</div>
          <div style={styles.groupControls}>
            <select
              value={currentGroupId}
              onChange={(event) => setCurrentGroupId(event.target.value)}
              style={styles.select}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>

            <div style={styles.groupCreateRow}>
              <input
                style={styles.input}
                value={groupNameInput}
                onChange={(event) => setGroupNameInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && createGroup()}
                placeholder="Create a new group"
                aria-label="New group name"
              />
              <button style={styles.buttonGhost} onClick={createGroup}>Create group</button>
            </div>

            <div style={styles.joinCodeCard}>
              <div style={styles.panelSubLabel}>Current group code</div>
              <div style={styles.joinCode}>{currentGroup?.join_code || '—'}</div>
            </div>

            <div style={styles.groupCreateRow}>
              <input
                style={styles.input}
                value={joinCodeInput}
                onChange={(event) => setJoinCodeInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && joinGroupByCode()}
                placeholder="Enter a friend’s join code"
                aria-label="Friend join code"
              />
              <button style={styles.buttonGhost} onClick={joinGroupByCode}>Join group</button>
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>Ask SmartSplit</div>
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              value={sentence}
              onChange={(event) => setSentence(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
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
          <div style={styles.panelHeader}>{currentGroup ? currentGroup.name : 'Group'} expenses</div>
          {visibleExpenses.length === 0 ? (
            <div style={styles.emptyState}>No expenses in this group yet.</div>
          ) : (
            <div style={styles.list}>
              {visibleExpenses.map((expense) => (
                <div key={expense.id} style={styles.expenseItem}>
                  <div style={styles.expenseEmoji}>{expense.emoji}</div>
                  <div style={styles.expenseContent}>
                    <div style={styles.expenseName}>{expense.name}</div>
                    <div style={styles.expenseMeta}>paid by {expense.paidBy}</div>
                  </div>
                  <div style={styles.expenseAmount}>{formatMoney(expense.amount)}</div>
                  <button style={styles.removeBtn} onClick={() => removeExpense(expense.id)} aria-label={`Remove ${expense.name}`}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
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
  panelSubLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  authCard: {
    display: 'grid',
    gap: 12,
    padding: '8px 0 0',
  },
  authRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  userBadge: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: 900,
    color: '#1d4ed8',
  },
  groupControls: {
    display: 'grid',
    gap: 12,
  },
  groupCreateRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  joinCodeCard: {
    display: 'grid',
    gap: 8,
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid #dbeafe',
    background: '#eff6ff',
  },
  joinCode: {
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: '0.14em',
    color: '#1d4ed8',
  },
  select: {
    width: '100%',
    padding: '14px 14px',
    borderRadius: 12,
    border: '1px solid #dfe8f7',
    background: '#f8fafc',
    fontSize: 15,
    fontWeight: 600,
    color: '#0f172a',
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
  buttonGhost: {
    border: '1px solid #bfdbfe',
    borderRadius: 14,
    background: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: 800,
    fontSize: 15,
    padding: '15px 18px',
    cursor: 'pointer',
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
  list: {
    display: 'grid',
    gap: 12,
  },
  expenseItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid #edf2f7',
  },
  expenseEmoji: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: '#f8fafc',
    border: '1px solid #dfe8f7',
    display: 'grid',
    placeItems: 'center',
    fontSize: 20,
  },
  expenseContent: {
    flex: 1,
    minWidth: 0,
  },
  expenseName: {
    fontWeight: 800,
    fontSize: 15,
  },
  expenseMeta: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12,
  },
  expenseAmount: {
    fontWeight: 800,
    fontSize: 15,
    whiteSpace: 'nowrap',
  },
  removeBtn: {
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    fontSize: 24,
    cursor: 'pointer',
    lineHeight: 1,
  },
  emptyState: {
    color: '#64748b',
    fontSize: 14,
    padding: '12px 0 4px',
  },
};
