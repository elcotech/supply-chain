import React, { useState, useEffect } from 'react';

interface DateTimeProps {
  /** Extra class names for layout (e.g. inside the header) */
  className?: string;
}

/**
 * Live Date & Time widget.
 * - Updates every second
 * - Beautiful transparent (glass) design
 * - Toggle buttons for "invert colors" and "fully transparent (ghost)" modes
 * Preferences are remembered in localStorage.
 */
const DateTime: React.FC<DateTimeProps> = ({ className = '' }) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [inverted, setInverted] = useState<boolean>(() => {
    try { return localStorage.getItem('datetime-inverted') === '1'; } catch { return false; }
  });
  const [ghost, setGhost] = useState<boolean>(() => {
    try { return localStorage.getItem('datetime-ghost') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('datetime-inverted', inverted ? '1' : '0'); } catch { /* ignore */ }
  }, [inverted]);

  useEffect(() => {
    try { localStorage.setItem('datetime-ghost', ghost ? '1' : '0'); } catch { /* ignore */ }
  }, [ghost]);

  const hours = now.getHours();
  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const timeStr = `${h12.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  const classes = [
    'datetime-widget',
    inverted ? 'inverted' : '',
    ghost ? 'ghost' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} aria-label="Current date and time">
      <div className="datetime-inner">
        <div className="datetime-time">
          <span className="datetime-hours">{timeStr}</span>
          <span className="datetime-ampm">{ampm}</span>
        </div>
        <div className="datetime-date">{dateStr}</div>
      </div>
      <div className="datetime-controls">
        <button
          type="button"
          className={'datetime-toggle ' + (inverted ? 'active' : '')}
          onClick={() => setInverted(v => !v)}
          title="Toggle inverted colors"
          aria-label="Toggle inverted colors"
        >
          🎨
        </button>
        <button
          type="button"
          className={'datetime-toggle ' + (ghost ? 'active' : '')}
          onClick={() => setGhost(v => !v)}
          title="Toggle transparency"
          aria-label="Toggle transparency"
        >
          👻
        </button>
      </div>
    </div>
  );
};

export default DateTime;
