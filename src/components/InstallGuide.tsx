// ===== src/components/InstallGuide.tsx =====
// Professional "Install E-SCON" experience with device-specific instructions.
// The app works fully in the browser; installing is optional and never forced.
import React, { useEffect, useState } from 'react';

interface InstallGuideProps {
  onClose: () => void;
}

type DeviceKind = 'android' | 'ios' | 'windows' | 'other';

const detectDevice = (): DeviceKind => {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(platform) || (/Mac/i.test(platform) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/win/i.test(platform)) return 'windows';
  return 'other';
};

const STEPS: Record<DeviceKind, { title: string; steps: string[] }> = {
  android: {
    title: 'Install on Android (Chrome)',
    steps: [
      'Open E-SCON in the Chrome browser.',
      'Tap the ⋮ menu (top right), then choose "Add to Home screen" or "Install app".',
      'Tap "Install" / "Add". E-SCON now appears as an app on your home screen.',
    ],
  },
  ios: {
    title: 'Install on iPhone / iPad (Safari)',
    steps: [
      'Open E-SCON in the Safari browser.',
      'Tap the Share button (square with arrow ⬆️).',
      'Scroll and tap "Add to Home Screen".',
      'Tap "Add". E-SCON now appears as an app on your home screen.',
    ],
  },
  windows: {
    title: 'Install on Windows',
    steps: [
      'Open E-SCON in Microsoft Edge or Chrome.',
      'Click the install icon (➕ or 📥) in the address bar, or open the browser menu → "Apps" → "Install this site as an app".',
      'Confirm. E-SCON opens in its own standalone window.',
    ],
  },
  other: {
    title: 'Install on your device',
    steps: [
      'Use Chrome or Edge for full installation support.',
      'Look for the install icon in the address bar, or use the browser menu → "Install app".',
      'Alternatively add the page to your home screen from the browser share menu.',
    ],
  },
};

const InstallGuide: React.FC<InstallGuideProps> = ({ onClose }) => {
  const [device, setDevice] = useState<DeviceKind>('other');

  useEffect(() => {
    setDevice(detectDevice());
  }, []);

  const guide = STEPS[device];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content install-guide-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📲 Install E-SCON</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="install-guide-intro">
            Install E-SCON as an app for faster access, a standalone window and
            a home-screen icon. You can keep using the website in your browser —
            installation is optional.
          </p>

          <div className="install-device-tabs">
            {(['android', 'ios', 'windows', 'other'] as DeviceKind[]).map(k => (
              <button
                key={k}
                className={'install-device-tab ' + (device === k ? 'active' : '')}
                onClick={() => setDevice(k)}
              >
                {k === 'android' ? '🤖 Android' : k === 'ios' ? '🍎 iPhone' : k === 'windows' ? '🖥️ Windows' : '🌐 Other'}
              </button>
            ))}
          </div>

          <div className="install-guide-box">
            <h3>{guide.title}</h3>
            <ol>
              {guide.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          <p className="install-guide-note">
            💡 Some browsers only offer installation over HTTPS. The app remains
            fully functional in the browser on every device.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InstallGuide;