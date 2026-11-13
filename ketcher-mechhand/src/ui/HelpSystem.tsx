/**
 * HelpSystem.tsx
 * Context-sensitive help for MecHand.
 *
 * Two components:
 *  1. <HelpProvider>  — wraps the app; holds the global "help visible" toggle.
 *  2. <HelpTip id="">  — wrap any icon or toolbar button to give it a tooltip.
 *                        When help is ON, shows an always-visible callout.
 *                        When help is OFF, shows only on hover (native title).
 *
 * Texts live in the locale files (src/i18n/locales/*.json, keys help.<id>.brief and .student).
 * Designed to serve both expert chemists (brief mode) and students (verbose mode).
 */

import React, {
  createContext, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { useT } from '../i18n/i18n';
import { useLevel } from '../levels/levels';

// ── Help content registry ─────────────────────────────────────────────────────

export type HelpLevel = 'brief' | 'student';

/** Help label ids (texts in the locale files under help.<id>.brief / help.<id>.student) and their shortcuts. */
export const HELP_SHORTCUTS: Record<string, string | undefined> = {
  'btn-freehand': 'Alt+F',
  'btn-recognize': 'Space',
  'btn-undo-ink': 'Ctrl/⌘+Z',
  'btn-redo-ink': 'Ctrl/⌘+Shift+Z',
  'btn-clear-ink': undefined,
  'tool-pen': 'P',
  'tool-eraser': 'E',
  'pen-colour': undefined,
  'pen-style': undefined,
  'pen-width': undefined,
  'pen-input': undefined,
  'pen-device': undefined,
  'btn-library': 'Ctrl/⌘+K',
  'btn-image': 'Ctrl/⌘+V',
  'btn-export': undefined,
  'btn-teach': undefined,
  'btn-about': undefined,
  'btn-periodic': undefined,
  'btn-level': undefined,
  'btn-help': 'F1',
  'btn-language': undefined,
  'btn-help-toggle': undefined,
};

// ── Context ───────────────────────────────────────────────────────────────────

interface HelpCtx {
  visible: boolean;
  level: HelpLevel;
  toggle: () => void;
  setLevel: (l: HelpLevel) => void;
}

const HelpContext = createContext<HelpCtx>({
  visible: false,
  level: 'student',
  toggle: () => {},
  setLevel: () => {},
});

export const useHelp = () => useContext(HelpContext);

// ── Provider ──────────────────────────────────────────────────────────────────

export const HelpProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  // The detail of the button help follows the user level (helpDetail in src/config/levels.json).
  const { features } = useLevel();
  const [level, setLevel] = useState<HelpLevel>(features.helpDetail);
  useEffect(() => setLevel(features.helpDetail), [features.helpDetail]);


  return (
    <HelpContext.Provider value={{ visible, level, toggle: () => setVisible((v) => !v), setLevel }}>
      {children}
    </HelpContext.Provider>
  );
};

// ── HelpToggleButton ──────────────────────────────────────────────────────────

export const HelpToggleButton: React.FC = () => {
  const { visible, level, toggle, setLevel } = useHelp();
  const { t } = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* Level selector */}
      {visible && (
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as HelpLevel)}
          style={{
            fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4,
            padding: '1px 4px', background: '#f9fafb', cursor: 'pointer',
          }}
          title={t('helpToggle.level')}
          aria-label={t('helpToggle.level')}
        >
          <option value="brief">{t('helpToggle.expert')}</option>
          <option value="student">{t('helpToggle.student')}</option>
        </select>
      )}
      {/* Toggle button */}
      <button
        onClick={toggle}
        title={t('helpToggle.title')}
        aria-label={t('helpToggle.title')}
        aria-pressed={visible}
        data-testid="mechand-help-labels"
        style={{
          width: 26, height: 26, borderRadius: 13,
          border: `2px solid ${visible ? '#3b82f6' : '#d1d5db'}`,
          background: visible ? '#eff6ff' : '#f9fafb',
          color: visible ? '#3b82f6' : '#9ca3af',
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ?
      </button>
    </div>
  );
};

// ── HelpTip ───────────────────────────────────────────────────────────────────

interface HelpTipProps {
  id: string;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'right' | 'left';
}

export const HelpTip: React.FC<HelpTipProps> = ({ id, children, placement = 'bottom' }) => {
  const { visible, level } = useHelp();
  const { t } = useT();
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!(id in HELP_SHORTCUTS)) return <>{children}</>;

  const text = t(`help.${id}.${level}`);
  const entry = { shortcut: HELP_SHORTCUTS[id] };
  const showCallout = visible || hovered;

  const placementStyle: React.CSSProperties =
    placement === 'bottom' ? { top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }
    : placement === 'top'  ? { bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }
    : placement === 'right'? { left: 'calc(100% + 6px)', top: '50%', transform: 'translateY(-50%)' }
    :                         { right: 'calc(100% + 6px)', top: '50%', transform: 'translateY(-50%)' };

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex' }}
      // Hover help for mouse and trackpad only: on touch screens a tap would leave it open.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={() => setHovered(false)}
    >
      {children}

      {showCallout && (
        <div
          style={{
            position: 'absolute',
            ...placementStyle,
            zIndex: 8000,
            background: '#1e293b',
            color: '#f8fafc',
            borderRadius: 7,
            padding: '7px 11px',
            fontSize: 12,
            lineHeight: 1.5,
            width: 'max-content',
            maxWidth: 260,
            whiteSpace: 'normal',
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            opacity: showCallout ? 1 : 0,
            transition: 'opacity 0.12s',
          }}
        >
          {text}
          {entry.shortcut && (
            <span
              style={{
                display: 'inline-block',
                marginLeft: 6,
                background: '#334155',
                borderRadius: 3,
                padding: '0 5px',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              {entry.shortcut}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
