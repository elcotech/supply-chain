// Language settings (spec 5 "Language Settings").
//
// The interface ships in English only. Translation is keyed by the English
// string itself, so the helper stays in place for future languages.

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
          <p>{t('The interface is available in English.')}</p>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>{t('Home Page')}</button>
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
            {lang === language.code && <span className="ws-language-check">{t('Active')}</span>}
          </button>
        ))}
      </div>

      <section className="card glass">
        <div className="card-header"><h2>{t('About translations')}</h2></div>
        <p>
          {t('The interface uses English labels for menus, page headings, buttons, table controls and workspace sections. Product names, supplier descriptions and free-text messages stay exactly as they were entered.')}
        </p>
        <p className="ws-muted">
          {t('The language choice is remembered on this device and applied to the whole interface immediately.')}
        </p>
      </section>
    </main>
  );
};

export default LanguagePage;
