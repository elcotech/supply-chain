// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker ONLY in production. In development, hot-reload
// + the SW cache cause stale same-origin responses. `npm run build` produces
// public/sw.js verbatim, so clients always get the fresh asset list.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(process.env.PUBLIC_URL + '/sw.js')
      .catch((error) => {
        console.warn('Service worker registration failed', error);
      });
  });
}