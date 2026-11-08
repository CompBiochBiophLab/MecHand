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
  createContext, useContext, useRef, useState, useEffect, ReactNode,
} from 'react';

// ── Help content registry ─────────────────────────────────────────────────────

export type HelpLevel = 'brief' | 'student';

export interface HelpEntry {
  brief: string;    // one line — for experts
  student: string;  // 2-3 lines — for students
  shortcut?: string;
}

export const HELP_CONTENT: Record<string, HelpEntry> = {
  // ── Drawing tools ──────────────────────────────────────────────────────────
  'tool-freehand': {
    brief: 'Draw atoms and bonds freehand. MecHand will recognise and clean up.',
    student:
      'Use your pen, stylus or mouse to sketch atoms and bonds naturally. ' +
      'When you pause or press Consolidate, MecHand will interpret your sketch ' +
      'and convert it to a clean structure. You can correct it before accepting.',
    shortcut: 'F',
  },
  'tool-atom': {
    brief: 'Click to place an atom; type its symbol.',
    student:
      'Click anywhere on the canvas to add an atom. A text cursor appears — ' +
      'type the element symbol (C, N, O, H, Ser, His…). ' +
      'Press Enter to confirm, Escape to cancel.',
    shortcut: 'A',
  },
  'tool-bond-single': {
    brief: 'Draw a single bond between two atoms.',
    student:
      'Click on a source atom and drag to the destination atom. ' +
      'Single bonds represent a shared electron pair (σ bond). ' +
      'If you click on empty space, a new carbon atom is created at both ends.',
    shortcut: '1',
  },
  'tool-bond-double': {
    brief: 'Draw a double bond (σ + π).',
    student:
      'Double bonds have one σ and one π component. ' +
      'They appear in C=O (carbonyl), C=C (alkene) and similar groups. ' +
      'Draw like a single bond — MecHand adds the second line automatically.',
    shortcut: '2',
  },
  'tool-arrow-curved': {
    brief: 'Draw a curved arrow showing electron movement.',
    student:
      'Curved arrows are the core of a reaction mechanism. ' +
      'They show where electrons move: draw from the electron source ' +
      '(lone pair, bond) to the destination (new bond, atom). ' +
      'Full arrows = 2 electrons; half-arrows (fishhook) = 1 electron (radicals).',
    shortcut: 'E',
  },
  'tool-arrow-half': {
    brief: 'Half-headed (fishhook) arrow — single electron movement.',
    student:
      'Use fishhook arrows in radical mechanisms where only one electron ' +
      'moves at a time. Draw from the radical centre to its destination.',
    shortcut: 'R',
  },
  'tool-charge-plus': {
    brief: 'Add a formal positive charge to an atom.',
    student:
      'A formal positive charge (⁺) means the atom has lost one electron ' +
      'relative to its neutral state. Click the atom to toggle the charge.',
  },
  'tool-charge-minus': {
    brief: 'Add a formal negative charge to an atom.',
    student:
      'A formal negative charge (⁻) means the atom has gained one electron ' +
      'relative to its neutral state. Common on O⁻, N⁻ in intermediates.',
  },
  'tool-lone-pair': {
    brief: 'Show a lone pair of electrons on an atom.',
    student:
      'Lone pairs are non-bonding electron pairs. Showing them explicitly ' +
      'helps clarify the source of curved arrows in nucleophilic steps. ' +
      'Click an atom, then pick how many lone pairs to display (1–3).',
  },
  // ── Consolidate ────────────────────────────────────────────────────────────
  'btn-consolidate': {
    brief: 'Recognise the current freehand sketch and propose a clean structure.',
    student:
      'Press Consolidate after sketching to let MecHand interpret what you drew. ' +
      'It will show you the interpreted structure and ask "is this what you meant?". ' +
      'You can confirm, edit or discard the proposal.',
    shortcut: 'Space',
  },
  // ── Export ─────────────────────────────────────────────────────────────────
  'btn-export-chemfig': {
    brief: 'Export the current diagram as chemfig LaTeX code.',
    student:
      'chemfig is a LaTeX package for drawing chemical structures. ' +
      'The exported code can be pasted directly into your .tex file. ' +
      'Add \\usepackage{chemfig} to your preamble.',
  },
  'btn-export-tikz': {
    brief: 'Export as TikZ code (absolute coordinates, easy to edit by hand).',
    student:
      'TikZ is a powerful LaTeX graphics library. ' +
      'The exported code uses absolute coordinates, which makes it easy to ' +
      'adjust atom positions and arrow curvatures manually in your editor.',
  },
  'btn-export-svg': {
    brief: 'Export as SVG vector image.',
    student:
      'SVG files can be opened in Inkscape, Illustrator or any vector editor. ' +
      'They scale to any size without loss of quality.',
  },
  // ── Help toggle itself ─────────────────────────────────────────────────────
  'btn-help-toggle': {
    brief: 'Show or hide contextual help labels.',
    student: 'Toggle the help system on or off. When on, each tool shows a brief description.',
    shortcut: '?',
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
  const [visible, setVisible] = useState(true); // on by default for new users
  const [level, setLevel] = useState<HelpLevel>('student');

  // Keyboard shortcut: ?
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) setVisible((v) => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
        title="Toggle help (shortcut: ?)"
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
