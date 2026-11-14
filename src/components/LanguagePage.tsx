// Language settings (spec §5 "Language Settings").
//
// The interface ships in English with an Amharic dictionary covering the
// navigation, headings, common actions and the workspace labels. Anything not
// yet translated falls back to English, so switching language never leaves an
// empty screen.

import React from 'react';
import { LANGUAGES, useLanguage } from '../lib/i18n';

interface LanguagePageProps {
  onBack: () => void;
}

const LanguagePage: React.FC<LanguagePageProps> = ({ onBack }) => {
  const { lang, setLang, t } = useLanguage();

  return (
    <main className="main-content ws-public">
      <section className="ws-hero">
        <div>
          <span className="ws-eyebrow">{t('Guests')}</span>
          <h1>{t('Language Settings')}</h1>
          <p>{t('English, Amharic and other supported languages.')}</p>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>← {t('Home Page')}</button>
      </section>

      <div className="ws-language-grid">
        {LANGUAGES.map(language => (
          <button
            key={language.code}
            type="button"
            className={'ws-language-card' + (lang === language.code ? ' active' : '')}
            onClick={() => setLang(language.code)}
            aria-pressed={lang === language.code}
          >
            <span className="ws-language-code">{language.code.toUpperCase()}</span>
            <strong>{language.native}</strong>
            <small>{language.label}</small>
            {lang === language.code && <span className="ws-language-check">✓ {t('Active')}</span>}
          </button>
        ))}
      </div>

      <section className="card glass">
        <div className="card-header"><h2>🌐 {t('About translations')}</h2></div>
        <p>
          {t('Menus, page headings, buttons, table controls and the workspace labels are translated. Product names, supplier descriptions and free-text messages stay in the language they were entered.')}
        </p>
        <p className="ws-muted">
          {t('Missing translations fall back to English automatically, so the platform stays usable in every language while the dictionary grows.')}
        </p>
        <p className="ws-muted">{t('The choice is remembered on this device and applied to the whole interface immediately.')}</p>
      </section>
    </main>
  );
};

export default LanguagePage;
