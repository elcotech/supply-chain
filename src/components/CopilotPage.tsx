// ===== src/components/CopilotPage.tsx =====
// E-SCON Copilot: an on-device, data-grounded assistant. Every answer is
// produced by src/lib/copilot.ts from the live records passed in here, so no
// question ever leaves the device and every figure can be traced to the app.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Company, Material, Order, ProductReview, SystemSettings, User } from '../types';
import {
  answerQuestion,
  copilotGreeting,
  copilotRoleLabel,
  copilotSuggestions,
  CopilotAnswer,
} from '../lib/copilot';
import { AnalyticsInput, analyticsRole, buildAnalytics } from '../lib/analytics';
import { formatCurrency } from '../utils';
import { MiniBarChart } from './Charts';

export interface CopilotPageProps {
  user: User | null;
  materials: Material[];
  companies: Company[];
  orders: Order[];
  users: User[];
  reviews: ProductReview[];
  settings: SystemSettings;
  seedPrompt?: string;
  onSeedConsumed?: () => void;
  onOpenAnalytics: () => void;
  onOpenMarketplace: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  answer?: CopilotAnswer;
  time: number;
}

const STORAGE_KEY = 'escon-copilot-chat-v1';
const MAX_MESSAGES = 40;

const makeId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isCurrencyLabel = (label?: string): boolean =>
  !!label && /(etb|revenue|spend|sales|price|value)/i.test(label);

const CopilotPage: React.FC<CopilotPageProps> = ({
  user,
  materials,
  companies,
  orders,
  users,
  reviews,
  settings,
  seedPrompt,
  onSeedConsumed,
  onOpenAnalytics,
  onOpenMarketplace,
}) => {
  const input: AnalyticsInput = useMemo(
    () => ({ user, materials, companies, orders, users, reviews, settings, days: 90 }),
    [user, materials, companies, orders, users, reviews, settings]
  );
  const role = analyticsRole(user);
  const roleLabel = copilotRoleLabel(role);
  const snapshot = useMemo(() => buildAnalytics(input), [input]);
  const suggestions = useMemo(() => copilotSuggestions(role), [role]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(-MAX_MESSAGES);
      }
    } catch {
      // Ignore corrupt storage and start a fresh conversation.
    }
    const greeting = copilotGreeting(input);
    return [{
      id: 'greeting',
      role: 'assistant',
      text: greeting.summary,
      answer: greeting,
      time: Date.now(),
    }];
  });
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const timerRef = useRef<number | null>(null);
  const seededRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
    } catch {
      // Storage can be full or blocked; the chat still works for this session.
    }
  }, [messages]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, typing]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const send = useCallback((question: string): void => {
    const trimmed = question.trim();
    if (!trimmed || typing) return;
    const userMessage: ChatMessage = {
      id: makeId(),
      role: 'user',
      text: trimmed,
      time: Date.now(),
    };
    setMessages(prev => [...prev, userMessage].slice(-MAX_MESSAGES));
    setDraft('');
    setShowSuggestions(false);
    setTyping(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const answer = answerQuestion(trimmed, input);
      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        text: answer.summary,
        answer,
        time: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage].slice(-MAX_MESSAGES));
      setTyping(false);
      timerRef.current = null;
    }, 420);
  }, [input, typing]);

  useEffect(() => {
    if (!seedPrompt || seededRef.current === seedPrompt) return;
    seededRef.current = seedPrompt;
    send(seedPrompt);
    onSeedConsumed?.();
  }, [seedPrompt, send, onSeedConsumed]);

  const clearChat = (): void => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTyping(false);
    const greeting = copilotGreeting(input);
    setMessages([{
      id: 'greeting-' + makeId(),
      role: 'assistant',
      text: greeting.summary,
      answer: greeting,
      time: Date.now(),
    }]);
    setShowSuggestions(true);
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    send(draft);
  };

  const lastAssistant = [...messages].reverse().find(message => message.role === 'assistant' && message.answer);
  const followUps = lastAssistant?.answer?.followUps && lastAssistant.answer.followUps.length > 0
    ? lastAssistant.answer.followUps
    : suggestions.slice(0, 3);

  const renderAnswer = (message: ChatMessage) => {
    const answer = message.answer;
    if (!answer) return <p className="copilot-text">{message.text}</p>;
    return (
      <div className="copilot-answer">
        <h3>{answer.title}</h3>
        <p className="copilot-text">{answer.summary}</p>
        {answer.metrics && answer.metrics.length > 0 && (
          <div className="copilot-metrics">
            {answer.metrics.map((metric, index) => (
              <div key={index} className={'copilot-metric' + (metric.tone ? ' ' + metric.tone : '')}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        )}
        {answer.bullets.length > 0 && (
          <ul className="copilot-bullets">
            {answer.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}
          </ul>
        )}
        {answer.chart && answer.chart.length > 0 && (
          <div className="copilot-chart">
            <div className="copilot-chart-head">
              <span>{answer.chartLabel || 'Live chart'}</span>
              <span className="escon-badge">{answer.chart.length} points</span>
            </div>
            <MiniBarChart
              data={answer.chart}
              height={128}
              valueFormatter={value => isCurrencyLabel(answer.chartLabel)
                ? formatCurrency(value)
                : value.toLocaleString()}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="main-content">
      <div className="escon-sheet copilot-sheet">
        <header className="escon-sheet-head copilot-head">
          <div className="escon-sheet-brand">
            <span className="escon-sheet-logo copilot-logo">🤖</span>
            <div>
              <span className="escon-kicker">E-SCON · Copilot AI</span>
              <h1 className="escon-sheet-title">Ask your supply chain</h1>
              <p className="escon-sheet-sub">Grounded in {snapshot.orderCount} orders, {snapshot.productCount} products and {snapshot.supplierCount} suppliers · private to this device</p>
            </div>
          </div>
          <div className="escon-sheet-meta">
            <span className={'escon-role-chip role-' + role}>{roleLabel} view</span>
            <span className="copilot-live"><i /> On-device · no cloud AI</span>
            <button type="button" className="escon-link" onClick={clearChat}>Clear conversation</button>
          </div>
        </header>

        <div className="copilot-shell">
          <section className="copilot-chat" aria-label="Copilot conversation">
            <div className="copilot-scroll" ref={scrollRef}>
              {messages.map(message => (
                <div key={message.id} className={'copilot-msg ' + message.role}>
                  <span className="copilot-avatar" aria-hidden="true">{message.role === 'user' ? '🧑' : '🤖'}</span>
                  <div className="copilot-bubble">
                    {message.role === 'assistant' ? renderAnswer(message) : <p className="copilot-text">{message.text}</p>}
                    <span className="copilot-time">{new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}

              {typing && (
                <div className="copilot-msg assistant">
                  <span className="copilot-avatar" aria-hidden="true">🤖</span>
                  <div className="copilot-bubble copilot-typing" aria-label="Copilot is typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}

              {showSuggestions && !typing && (
                <div className="copilot-starter">
                  <h3>Try a question</h3>
                  <div className="copilot-starter-grid">
                    {suggestions.map(prompt => (
                      <button key={prompt} type="button" onClick={() => send(prompt)}>{prompt}<span>→</span></button>
                    ))}
                  </div>
                </div>
              )}

              {!typing && messages.length > 1 && followUps.length > 0 && (
                <div className="copilot-followups">
                  <span>Follow up</span>
                  {followUps.map(prompt => (
                    <button key={prompt} type="button" onClick={() => send(prompt)}>{prompt}</button>
                  ))}
                </div>
              )}
            </div>

            <form className="copilot-composer" onSubmit={handleSubmit}>
              <input
                type="text"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder={`Ask about orders, stock, prices, suppliers…`}
                aria-label="Ask Copilot"
                disabled={typing}
              />
              <button type="submit" className="copilot-send" disabled={typing || !draft.trim()} aria-label="Send question">
                {typing ? '…' : 'Send ↑'}
              </button>
            </form>
            <p className="copilot-disclaimer">Answers use your live E-SCON records only. Copilot never sends data to an external AI service.</p>
          </section>

          <aside className="copilot-side" aria-label="Copilot data context">
            <div className="copilot-side-card">
              <h2>Live context</h2>
              <dl>
                <div><dt>Scope</dt><dd>{snapshot.scopeLabel}</dd></div>
                <div><dt>Period</dt><dd>{snapshot.periodLabel}</dd></div>
                <div><dt>Revenue tracked</dt><dd>{formatCurrency(snapshot.gmv)}</dd></div>
                <div><dt>Orders</dt><dd>{snapshot.orderCount} · {snapshot.activeOrders} active</dd></div>
                <div><dt>Products</dt><dd>{snapshot.productCount} · {snapshot.lowStockCount} low</dd></div>
                <div><dt>Suppliers</dt><dd>{snapshot.supplierCount} in {snapshot.cityCount} cities</dd></div>
                <div><dt>Reviews</dt><dd>{snapshot.reviewCount} · ⭐ {snapshot.avgRating.toFixed(1)}</dd></div>
              </dl>
            </div>

            <div className="copilot-side-card">
              <h2>Open a full report</h2>
              <button type="button" className="copilot-side-action" onClick={onOpenAnalytics}>
                <span>📊</span>
                <div><strong>Analytics &amp; Insights</strong><small>Charts, KPIs and export</small></div>
              </button>
              <button type="button" className="copilot-side-action" onClick={onOpenMarketplace}>
                <span>🛍️</span>
                <div><strong>Marketplace</strong><small>Products and suppliers</small></div>
              </button>
            </div>

            <div className="copilot-side-card">
              <h2>What Copilot can answer</h2>
              <ul className="copilot-capabilities">
                <li>Revenue, growth and order trends</li>
                <li>Stock levels and restock priorities</li>
                <li>Best products, suppliers and customers</li>
                <li>Price forecasts and delivery costs</li>
                <li>VAT, payments and category performance</li>
              </ul>
            </div>
          </aside>
        </div>

        <footer className="escon-sheet-foot">
          <span>E-SCON Copilot · deterministic business intelligence</span>
          <span>{user ? 'Signed in · answers scoped to your account' : 'Visitor view · browse-only data'}</span>
        </footer>
      </div>
    </main>
  );
};

export default CopilotPage;
