import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n/i18n';

// The user study runs in Catalan unless ?lang= says otherwise (estudi/ in the repository).
const studyMode = new URLSearchParams(location.search).get('study') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider initial={studyMode ? 'ca' : undefined} fixed={studyMode}>
      <App />
    </I18nProvider>
  </StrictMode>,
);
