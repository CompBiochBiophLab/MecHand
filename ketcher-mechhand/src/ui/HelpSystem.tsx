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
 * Content lives in HELP_CONTENT below — edit this map to adjust copy.
 * Designed to serve both expert chemists (brief mode) and students (verbose mode).
 */

import React, {
  createContext, useContext, useRef, useState, type ReactNode,
} from 'react';

// ── Help content registry ─────────────────────────────────────────────────────

export type HelpLevel = 'brief' | 'student';

export interface HelpEntry {
  brief: string;    // one line — for experts
  student: string;  // 2-3 lines — for students
  shortcut?: string;
}

export const HELP_CONTENT: Record<string, HelpEntry> = {
  'btn-freehand': {
    brief: 'Freehand mode: draw on top of Ketcher with pen, trackpad or mouse.',
    student:
      'Turn this on and draw the mechanism as on paper: bonds as lines (zig-zag chains ' +
      'and rings can be one stroke), atom labels as letters, charges as + or −, and ' +
      'curved arrows with a head. Turn it off to use Ketcher\'s own tools again.',
    shortcut: 'Alt+F',
  },
  'btn-recognize': {
    brief: 'Recognize the ink and propose a clean structure.',
    student:
      'MecHand reads your strokes in the browser (no server), shows what it understood ' +
      'and checks the electron flow of the curved arrows. Confirm to insert it into Ketcher.',
    shortcut: 'Space',
  },
  'btn-undo-ink': {
    brief: 'Remove the last stroke.',
    student: 'Removes only the last freehand stroke; Ketcher\'s structure is not touched.',
    shortcut: 'Ctrl/⌘+Z (in freehand mode)',
  },
  'btn-clear-ink': {
    brief: 'Remove all ink.',
    student: 'Deletes all freehand strokes that have not been inserted yet.',
  },
  'menu-templates': {
    brief: 'Open a standard mechanism (organic, inorganic, biochemistry).',
    student:
      'Loads a textbook mechanism into Ketcher. Use it to see how arrows are drawn, to ' +
      'practise redrawing it by hand, or to try the LaTeX export.',
  },
  'btn-export': {
    brief: 'Export to TikZ, chemfig, ChemDraw (CDXML), MOL/RXN, KET or SMILES.',
    student:
      'Converts the Ketcher canvas, including curved arrows, into code for your LaTeX ' +
      'document, or into files that ChemDraw, Marvin and other editors open.',
  },
  'btn-teach': {
    brief: 'Teach MecHand your handwriting.',
    student:
      'Draw a few examples of a letter or sign. They are stored in this browser and used ' +
      'immediately; export them to contribute them to the shared model.',
  },
  'btn-about': {
    brief: 'How recognition works, model version and browser support.',
    student: 'Shows the recognition model in use, what it can read, and known browser issues.',
  },
  'btn-help-toggle': {
    brief: 'Show or hide these help labels.',
    student: 'Toggle the help labels. Choose Expert for one-liners or Student for explanations.',
  },
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
  const [level, setLevel] = useState<HelpLevel>('student');


  return (
    <HelpContext.Provider value={{ visible, level, toggle: () => setVisible((v) => !v), setLevel }}>
      {children}
    </HelpContext.Provider>
  );
};

// ── HelpToggleButton ──────────────────────────────────────────────────────────

export const HelpToggleButton: React.FC = () => {
  const { visible, level, toggle, setLevel } = useHelp();
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
          title="Help detail level"
        >
          <option value="brief">Expert</option>
          <option value="student">Student</option>
        </select>
      )}
      {/* Toggle button */}
      <button
        onClick={toggle}
        title="Toggle help labels"
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
  const entry = HELP_CONTENT[id];
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!entry) return <>{children}</>;

  const text = entry[level];
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
            maxWidth: 240,
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
