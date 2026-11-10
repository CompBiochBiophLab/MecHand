/** The MecHand toolbar shown above Ketcher. */

import type { CSSProperties, ReactNode } from 'react';
import { LOCALES, useT } from '../i18n/i18n';
import { HelpTip, HelpToggleButton } from './HelpSystem';
import {
  ExportIcon, GlobeIcon, HelpIcon, ImageIcon, InfoIcon, LibraryIcon, MecHandLogo, PenIcon, RecognizeIcon, RedoIcon, TeachIcon, TrashIcon, UndoIcon,
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
  /** Accessible name (also what screen readers say when there is no visible text). */
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

/** Language menu: every locale file in src/i18n/locales. */
function LanguageMenu() {
  const { lang, setLang, t } = useT();
  return (
    <label style={{ ...toolButtonStyle(), padding: '0 4px 0 8px', gap: 4, cursor: 'pointer' }}>
      <GlobeIcon />
      <select
        value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('toolbar.language')} data-testid="mechand-language"
        style={{ border: 'none', background: 'transparent', fontSize: 13, color: 'inherit', padding: '6px 2px', cursor: 'pointer', maxWidth: 110 }}
      >
        {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  );
}

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
  onLibrary: () => void;
  onImage: () => void;
  onExport: () => void;
  onTeach: () => void;
  onAbout: () => void;
  onHelp: () => void;
  /** Icons without text (narrow space; see useCompact). */
  compact: boolean;
  /** Study mode: features switched off for the current task or phase. */
  disabled?: { freehand?: boolean; templates?: boolean; teach?: boolean };
}) {
  const off = props.disabled ?? {};
  const { compact } = props;
  const { t } = useT();
  return (
    <div style={barStyle} data-testid="mechand-bar" role="toolbar" aria-label={t('toolbar.label')}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 6 }}>
        <MecHandLogo />
        <b style={{ fontSize: 14, letterSpacing: 0.2 }}>MecHand</b>
      </span>
      <HelpTip id="btn-freehand">
        <ToolButton
          icon={<PenIcon />}
          label={<>{t('toolbar.freehand')} <span style={{ fontSize: 11, opacity: 0.75 }}>{props.freehand ? t('toolbar.on') : t('toolbar.off')}</span></>}
          name={t('toolbar.freehandName')} active={props.freehand} pressed={props.freehand} disabled={off.freehand}
          onClick={props.onFreehand} testId="mechand-freehand"
        />
      </HelpTip>
      <HelpTip id="btn-recognize">
        <ToolButton
          icon={<RecognizeIcon />}
          label={props.strokeCount ? t('toolbar.recognizeCount', { count: props.strokeCount }) : t('toolbar.recognize')}
          name={t('toolbar.recognizeName')} disabled={!props.strokeCount} onClick={props.onRecognize} testId="mechand-recognize"
        />
      </HelpTip>
      <HelpTip id="btn-undo-ink">
        <ToolButton icon={<UndoIcon />} name={t('toolbar.undoInk')} showLabel={false} disabled={!props.canUndo} onClick={props.onUndo} testId="mechand-undo-ink" />
      </HelpTip>
      <HelpTip id="btn-redo-ink">
        <ToolButton icon={<RedoIcon />} name={t('toolbar.redoInk')} showLabel={false} disabled={!props.canRedo} onClick={props.onRedo} testId="mechand-redo-ink" />
      </HelpTip>
      <HelpTip id="btn-clear-ink">
        <ToolButton icon={<TrashIcon />} name={t('toolbar.clearInk')} showLabel={false} disabled={!props.strokeCount} onClick={props.onClear} testId="mechand-clear-ink" />
      </HelpTip>
      {divider}
      <HelpTip id="btn-library">
        <ToolButton icon={<LibraryIcon />} label={t('toolbar.library')} name={t('toolbar.libraryName')} showLabel={!compact} disabled={off.templates} onClick={props.onLibrary} testId="mechand-library-btn" />
      </HelpTip>
      <HelpTip id="btn-image">
        <ToolButton icon={<ImageIcon />} label={t('toolbar.image')} name={t('toolbar.imageName')} showLabel={!compact} disabled={off.templates} onClick={props.onImage} testId="mechand-image-btn" />
      </HelpTip>
      <HelpTip id="btn-export">
        <ToolButton icon={<ExportIcon />} label={t('toolbar.export')} name={t('toolbar.export')} showLabel={!compact} onClick={props.onExport} testId="mechand-export-btn" />
      </HelpTip>
      <HelpTip id="btn-teach">
        <ToolButton icon={<TeachIcon />} label={t('toolbar.teach')} name={t('toolbar.teach')} showLabel={!compact} disabled={off.teach} onClick={props.onTeach} testId="mechand-teach-btn" />
      </HelpTip>
      <span style={{ flex: 1 }} />
      <HelpTip id="btn-language" placement="left">
        <LanguageMenu />
      </HelpTip>
      <HelpTip id="btn-help" placement="left">
        <ToolButton icon={<HelpIcon />} label={t('toolbar.help')} name={t('toolbar.help')} showLabel={!compact} onClick={props.onHelp} testId="mechand-help-btn" />
      </HelpTip>
      <HelpTip id="btn-about" placement="left">
        <ToolButton icon={<InfoIcon />} label={t('toolbar.about')} name={t('toolbar.about')} showLabel={!compact} onClick={props.onAbout} testId="mechand-about-btn" />
      </HelpTip>
      <HelpToggleButton />
    </div>
  );
}
