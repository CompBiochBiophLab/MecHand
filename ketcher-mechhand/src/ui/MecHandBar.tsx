/** The MecHand toolbar shown above Ketcher. */

import type { CSSProperties } from 'react';
import { CATEGORY_LABEL, TEMPLATES } from '../templates/catalog';
import { HelpTip, HelpToggleButton } from './HelpSystem';

const bar: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', flexWrap: 'wrap',
  borderBottom: '1px solid #e5e7eb', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', fontSize: 13,
};
const button = (active = false): CSSProperties => ({
  border: `1px solid ${active ? '#2563eb' : '#d1d5db'}`, background: active ? '#dbeafe' : '#fff',
  color: active ? '#1d4ed8' : '#111827', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 13,
});

export function MecHandBar(props: {
  freehand: boolean;
  strokeCount: number;
  onFreehand: () => void;
  onRecognize: () => void;
  onUndo: () => void;
  onClear: () => void;
  onTemplate: (id: string) => void;
  onExport: () => void;
  onTeach: () => void;
  onAbout: () => void;
  /** Study mode: features switched off for the current task or phase. */
  disabled?: { freehand?: boolean; templates?: boolean; teach?: boolean };
}) {
  const off = props.disabled ?? {};
  const categories = [...new Set(TEMPLATES.map((t) => t.category))];
  return (
    <div style={bar} data-testid="mechand-bar">
      <b style={{ marginRight: 6 }}>MecHand</b>
      <HelpTip id="btn-freehand">
        <button style={button(props.freehand)} onClick={props.onFreehand} data-testid="mechand-freehand" aria-pressed={props.freehand} disabled={off.freehand}>
          ✎ Freehand {props.freehand ? 'on' : 'off'}
        </button>
      </HelpTip>
      <HelpTip id="btn-recognize">
        <button style={button()} onClick={props.onRecognize} disabled={!props.strokeCount} data-testid="mechand-recognize">
          ✓ Recognize{props.strokeCount ? ` (${props.strokeCount})` : ''}
        </button>
      </HelpTip>
      <HelpTip id="btn-undo-ink">
        <button style={button()} onClick={props.onUndo} disabled={!props.strokeCount}>↶ Undo ink</button>
      </HelpTip>
      <HelpTip id="btn-clear-ink">
        <button style={button()} onClick={props.onClear} disabled={!props.strokeCount}>Clear ink</button>
      </HelpTip>
      <span style={{ width: 1, height: 22, background: '#e5e7eb', margin: '0 4px' }} />
      <HelpTip id="menu-templates">
        <select
          data-testid="mechand-templates"
          value=""
          onChange={(e) => e.target.value && props.onTemplate(e.target.value)}
          style={{ ...button(), padding: '5px 6px' }}
          disabled={off.templates}
          aria-label="Open a mechanism template"
        >
          <option value="">Templates…</option>
          {categories.map((c) => (
            <optgroup key={c} label={CATEGORY_LABEL[c]}>
              {TEMPLATES.filter((t) => t.category === c).map((t) => (
                <option key={t.id} value={t.id} title={t.description}>{t.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </HelpTip>
      <HelpTip id="btn-export">
        <button style={button()} onClick={props.onExport} data-testid="mechand-export-btn">⇩ Export</button>
      </HelpTip>
      <HelpTip id="btn-teach">
        <button style={button()} onClick={props.onTeach} disabled={off.teach}>✍ Teach</button>
      </HelpTip>
      <span style={{ flex: 1 }} />
      <HelpTip id="btn-about" placement="left">
        <button style={button()} onClick={props.onAbout}>About</button>
      </HelpTip>
      <HelpToggleButton />
    </div>
  );
}
