/** The MecHand toolbar shown above Ketcher. */

import type { CSSProperties, ReactNode } from 'react';
import { CATEGORY_LABEL, TEMPLATES } from '../templates/catalog';
import { HelpTip, HelpToggleButton } from './HelpSystem';
import {
  ExportIcon, InfoIcon, LibraryIcon, MecHandLogo, PenIcon, RecognizeIcon, RedoIcon, TeachIcon, TrashIcon, UndoIcon,
} from './icons';

export const barStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', flexWrap: 'wrap',
  borderBottom: '1px solid #e5e7eb', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', fontSize: 13,
};

export function toolButtonStyle(active = false, disabled = false): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, minWidth: 32, justifyContent: 'center',
    border: `1px solid ${active ? '#2563eb' : '#d1d5db'}`, background: active ? '#dbeafe' : '#fff',
    color: disabled ? '#9ca3af' : active ? '#1d4ed8' : '#1f2937', borderRadius: 7, padding: '4px 9px',
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', lineHeight: 1,
    boxShadow: active ? 'inset 0 1px 2px rgba(29,78,216,0.15)' : '0 1px 1px rgba(0,0,0,0.03)',
  };
}

/** A toolbar button: an icon, an optional text, and an accessible name. */
export function ToolButton({ icon, label, name, active, disabled, onClick, testId, showLabel = true, pressed }: {
  icon: ReactNode;
  label?: ReactNode;
  /** Accessible name (also the tooltip when there is no visible text). */
  name: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  testId?: string;
  showLabel?: boolean;
  /** Toggle buttons report their state to assistive technology. */
  pressed?: boolean;
}) {
  return (
    <button
      type="button" style={toolButtonStyle(active, disabled)} onClick={onClick} disabled={disabled}
      data-testid={testId} aria-label={showLabel && label ? undefined : name}
      aria-pressed={pressed}
    >
      {icon}
      {showLabel && label && <span>{label}</span>}
    </button>
  );
}

const divider = <span style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }} />;

export function MecHandBar(props: {
  freehand: boolean;
  strokeCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onFreehand: () => void;
  onRecognize: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onTemplate: (id: string) => void;
  onLibrary?: () => void;
  onExport: () => void;
  onTeach: () => void;
  onAbout: () => void;
  /** Study mode: features switched off for the current task or phase. */
  disabled?: { freehand?: boolean; templates?: boolean; teach?: boolean };
}) {
  const off = props.disabled ?? {};
  const categories = [...new Set(TEMPLATES.map((t) => t.category))];
  return (
    <div style={barStyle} data-testid="mechand-bar" role="toolbar" aria-label="MecHand">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 6 }}>
        <MecHandLogo />
        <b style={{ fontSize: 14, letterSpacing: 0.2 }}>MecHand</b>
      </span>
      <HelpTip id="btn-freehand">
        <ToolButton
          icon={<PenIcon />} label={<>Freehand <span style={{ fontSize: 11, opacity: 0.75 }}>{props.freehand ? 'on' : 'off'}</span></>}
          name="Freehand drawing" active={props.freehand} pressed={props.freehand} disabled={off.freehand}
          onClick={props.onFreehand} testId="mechand-freehand"
        />
      </HelpTip>
      <HelpTip id="btn-recognize">
        <ToolButton
          icon={<RecognizeIcon />} label={<>Recognize{props.strokeCount ? ` (${props.strokeCount})` : ''}</>} name="Recognize the ink"
          disabled={!props.strokeCount} onClick={props.onRecognize} testId="mechand-recognize"
        />
      </HelpTip>
      <HelpTip id="btn-undo-ink">
        <ToolButton icon={<UndoIcon />} name="Undo ink" showLabel={false} disabled={!props.canUndo} onClick={props.onUndo} testId="mechand-undo-ink" />
      </HelpTip>
      <HelpTip id="btn-redo-ink">
        <ToolButton icon={<RedoIcon />} name="Redo ink" showLabel={false} disabled={!props.canRedo} onClick={props.onRedo} testId="mechand-redo-ink" />
      </HelpTip>
      <HelpTip id="btn-clear-ink">
        <ToolButton icon={<TrashIcon />} name="Clear ink" showLabel={false} disabled={!props.strokeCount} onClick={props.onClear} testId="mechand-clear-ink" />
      </HelpTip>
      {divider}
      {props.onLibrary && (
        <HelpTip id="btn-library">
          <ToolButton icon={<LibraryIcon />} label="Library" name="Template library" disabled={off.templates} onClick={props.onLibrary} testId="mechand-library-btn" />
        </HelpTip>
      )}
      <HelpTip id="menu-templates">
        <select
          data-testid="mechand-templates"
          value=""
          onChange={(e) => e.target.value && props.onTemplate(e.target.value)}
          style={{ ...toolButtonStyle(false, off.templates), display: 'inline-block', width: 150, padding: '4px 6px' }}
          disabled={off.templates}
          aria-label="Open a mechanism template"
        >
          <option value="">Mechanisms…</option>
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
        <ToolButton icon={<ExportIcon />} label="Export" name="Export" onClick={props.onExport} testId="mechand-export-btn" />
      </HelpTip>
      <HelpTip id="btn-teach">
        <ToolButton icon={<TeachIcon />} label="Teach" name="Teach" disabled={off.teach} onClick={props.onTeach} testId="mechand-teach-btn" />
      </HelpTip>
      <span style={{ flex: 1 }} />
      <HelpTip id="btn-about" placement="left">
        <ToolButton icon={<InfoIcon />} label="About" name="About" onClick={props.onAbout} />
      </HelpTip>
      <HelpToggleButton />
    </div>
  );
}

