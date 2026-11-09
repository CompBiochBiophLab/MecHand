/** About: how recognition works, the model in use, the engine and browser notes. */

import type { SymbolModel } from '../recognition/model';
import { Modal } from './Modal';

export type Engine = 'browser' | 'server';

export function AboutPanel({ model, engine, backendUrl, backendOk, backendEngine, onEngine, onBackendUrl, onClose }: {
  model: SymbolModel;
  engine: Engine;
  backendUrl: string;
  backendOk: boolean | null;
  backendEngine?: string;
  onEngine: (e: Engine) => void;
  onBackendUrl: (u: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="About MecHand recognition" onClose={onClose} width={640} testId="mechand-about">
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
        <p style={{ marginTop: 0 }}>
          MecHand reads your <b>strokes</b> (not a picture of them) directly in the browser: no installation, no
          server, nothing leaves your computer. Lines become bonds (chains and rings can be one stroke), parallel
          lines become double/triple bonds, letters become atom labels, + and − become charges, and curved strokes
          with a head become electron-flow arrows (full head = 2 e⁻, single barb = 1 e⁻). Each arrow is anchored
          to the nearest atom or bond and checked for electron bookkeeping.
        </p>
        <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ paddingRight: 12 }}>Symbol model</td><td><b>{model.name}</b> v{model.version}</td></tr>
            <tr><td>Templates in use</td><td>{model.templateCount} ({model.contributedCount} contributed, {model.userCount} yours)</td></tr>
            <tr><td>Classifier</td><td>$P point-cloud recognizer (Vatavu, Anthony &amp; Wobbrock, ICMI 2012)</td></tr>
            <tr><td>Corner finding</td><td>ShortStraw (Wolin, Eoff &amp; Hammond, 2008)</td></tr>
          </tbody>
        </table>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Structure engine</h3>
        <label style={{ display: 'block' }}>
          <input type="radio" checked={engine === 'browser'} onChange={() => onEngine('browser')} /> In-browser (default, works offline)
        </label>
        <label style={{ display: 'block' }}>
          <input type="radio" checked={engine === 'server'} onChange={() => onEngine('server')} /> DECIMER server (optional,
          image-based, runs on your computer; arrows and charges still come from the in-browser recognizer)
        </label>
        {engine === 'server' && (
          <div style={{ marginTop: 4 }}>
            <input value={backendUrl} onChange={(e) => onBackendUrl(e.target.value)} style={{ width: 260 }} />{' '}
            {backendOk === null ? 'checking…' : backendOk ? `● connected — ${backendEngine ?? 'server'}` : '○ not reachable (see README, "Optional recognition server")'}
          </div>
        )}
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Browsers</h3>
        <p style={{ margin: 0 }}>
          Works in current Chrome, Edge, Firefox and Safari (desktop and iPad). Known differences are listed in
          the README under “Browser support”.
        </p>
        <p>
          <a href="https://github.com/JordiVillaFreixa/MecHand#readme" target="_blank" rel="noreferrer">Documentation</a> ·{' '}
          <a href="https://github.com/JordiVillaFreixa/MecHand/tree/main/ketcher-mechhand/src/recognition" target="_blank" rel="noreferrer">Recognizer source</a>
        </p>
      </div>
    </Modal>
  );
}
