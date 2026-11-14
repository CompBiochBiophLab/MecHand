import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n/i18n';
import { LevelProvider } from './levels/levels';

// The user study runs in Catalan unless ?lang= says otherwise (the study protocol, published with the article).
const studyMode = new URLSearchParams(location.search).get('study') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider initial={studyMode ? 'ca' : undefined} fixed={studyMode}>
      <LevelProvider study={studyMode}>
        <App />
      </LevelProvider>
    </I18nProvider>
  </StrictMode>,
);
