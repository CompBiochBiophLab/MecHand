/** About: how recognition works, the model in use, the engine and browser notes. */

import type { SymbolModel } from '../recognition/model';
import { LOCALES, Rich, useT } from '../i18n/i18n';
import { Modal } from './Modal';

export type Engine = 'browser' | 'server';

export function AboutPanel({ model, engine, backendUrl, backendOk, backendEngine, onEngine, onBackendUrl, onClose, serverAllowed = true, version }: {
  model: SymbolModel;
  /** App version and commit. */
  version?: string;
  /** False in study mode: the in-browser engine only, so that nothing leaves the browser. */
  serverAllowed?: boolean;
  engine: Engine;
  backendUrl: string;
  backendOk: boolean | null;
  backendEngine?: string;
  onEngine: (e: Engine) => void;
  onBackendUrl: (u: string) => void;
  onClose: () => void;
}) {
  const { t, lang } = useT();
  const locale = LOCALES.find((l) => l.code === lang);
  return (
    <Modal title={t('about.title')} onClose={onClose} width={640} testId="mechand-about">
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
        <p style={{ marginTop: 0 }}><Rich text={t('about.intro')} /></p>
        <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
          <tbody>
            {version && <tr><td style={{ paddingRight: 12 }}>{t('about.version')}</td><td data-testid="mechand-version">{version}</td></tr>}
            <tr><td style={{ paddingRight: 12 }}>{t('about.symbolModel')}</td><td><b>{model.name}</b> v{model.version}</td></tr>
            <tr><td>{t('about.templates')}</td><td>{t('about.templatesValue', { total: model.templateCount, contributed: model.contributedCount, user: model.userCount })}</td></tr>
            <tr><td>{t('about.elements')}</td><td>{t('about.elementsValue', {
              total: model.contributedElementCount + model.userElementCount, contributed: model.contributedElementCount,
              user: model.userElementCount, heads: model.heads.size,
            })}</td></tr>
            <tr><td>{t('about.classifier')}</td><td>$P point-cloud recognizer (Vatavu, Anthony &amp; Wobbrock, ICMI 2012)</td></tr>
            <tr><td>{t('about.corners')}</td><td>ShortStraw (Wolin, Eoff &amp; Hammond, 2008)</td></tr>
            {locale && lang !== 'en' && locale.authors.length > 0 && (
              <tr><td>{t('about.translation')}</td><td>{locale.name} · {t('about.translationBy', { authors: locale.authors.join(', ') })}</td></tr>
            )}
          </tbody>
        </table>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>{t('about.engine')}</h3>
        {!serverAllowed ? (
          <p style={{ margin: 0 }} data-testid="mechand-engine-locked">{t('about.engineLocked')}</p>
        ) : (<>
          <label style={{ display: 'block' }}>
            <input type="radio" checked={engine === 'browser'} onChange={() => onEngine('browser')} /> {t('about.engineBrowser')}
          </label>
          <label style={{ display: 'block' }}>
            <input type="radio" checked={engine === 'server'} onChange={() => onEngine('server')} /> {t('about.engineServer')}
          </label>
          {engine === 'server' && (
            <div style={{ marginTop: 4 }}>
              <input value={backendUrl} onChange={(e) => onBackendUrl(e.target.value)} style={{ width: 260 }} />{' '}
              {backendOk === null ? t('about.checking') : backendOk ? t('about.connected', { engine: backendEngine ?? 'server' }) : t('about.unreachable')}
            </div>
          )}
        </>)}
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>{t('about.browsers')}</h3>
        <p style={{ margin: 0 }}>{t('about.browsersText')}</p>
        <p>
          <a href="https://compbiochbiophlab.github.io/MecHand/guide/getting-started" target="_blank" rel="noreferrer">{t('about.documentation')}</a> ·{' '}
          <a href="https://github.com/CompBiochBiophLab/MecHand/tree/main/ketcher-mechhand/src/recognition" target="_blank" rel="noreferrer">{t('about.source')}</a>
        </p>
      </div>
    </Modal>
  );
}
