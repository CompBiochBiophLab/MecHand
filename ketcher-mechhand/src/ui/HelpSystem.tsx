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
    brief: 'Freehand mode: draw on top of Ketcher with a pen, finger, trackpad or mouse.',
    student:
      'Turn this on and draw the mechanism as on paper: bonds as lines (zig-zag chains ' +
      'and rings can be one stroke), atom labels as letters, charges as + or −, and ' +
      'curved arrows with a head. The pen bar below sets colour, line and input. ' +
      'Turn it off to use Ketcher\'s own tools again.',
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
    brief: 'Undo the last change to the ink (stroke, erasure or clear).',
    student: 'Undoes the last stroke, erasure or clear. Ketcher\'s structure is not touched.',
    shortcut: 'Ctrl/⌘+Z',
  },
  'btn-redo-ink': {
    brief: 'Redo what Undo ink undid.',
    student: 'Puts back the last change that Undo ink removed.',
    shortcut: 'Ctrl/⌘+Shift+Z',
  },
  'btn-clear-ink': {
    brief: 'Remove all ink (can be undone).',
    student: 'Deletes all freehand strokes that have not been inserted yet. Undo ink brings them back.',
  },
  'tool-pen': {
    brief: 'Draw ink.',
    student: 'The pen draws strokes. Choose its colour, kind of line and width on this bar.',
    shortcut: 'P',
  },
  'tool-eraser': {
    brief: 'Erase whole strokes by touching them.',
    student:
      'Drag over the strokes you want to remove (they fade) and lift: they are erased. ' +
      'The eraser end of a pen (Surface, Wacom) erases too, whatever tool is selected.',
    shortcut: 'E',
  },
  'pen-colour': {
    brief: 'Ink colour.',
    student: 'Colours help you organise a drawing (e.g. arrows in red). Recognition ignores colour.',
  },
  'pen-style': {
    brief: 'Kind of line: ballpoint, fountain pen, marker or dashed.',
    student:
      'Ballpoint draws an even line; the fountain pen follows pen pressure (or speed with a mouse); ' +
      'the marker is broad and translucent; dashed is only a look. All are recognized the same way.',
  },
  'pen-width': {
    brief: 'Line width.',
    student: 'From fine to extra bold. Only the look changes; recognition uses the shape of the stroke.',
  },
  'pen-input': {
    brief: 'Which inputs draw: auto, pen only, pen and finger, or trackpad.',
    student:
      'Auto: once you use a pen, fingers and palms are ignored. Pen only: fingers never draw. ' +
      'Pen and finger: both draw. Trackpad: click to start a stroke, move without pressing, ' +
      'click to end it (no click-and-drag needed).',
  },
  'pen-device': {
    brief: 'The device of the last contact, and whether it could draw.',
    student:
      'Shows whether the browser saw a pen, a finger or a mouse/trackpad. "Ignored" means palm ' +
      'rejection discarded the contact; change the input mode if your finger should draw.',
  },
  'btn-library': {
    brief: 'Template library: rings, functional groups, biomolecules, reagents and mechanisms.',
    student:
      'Search by name or formula, keep favourites, and add a structure to the canvas or open a ' +
      'complete mechanism.',
    shortcut: 'Ctrl/⌘+K',
  },
  'menu-templates': {
    brief: 'Open a complete textbook mechanism (organic, inorganic, biochemistry).',
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
      'Draw a few examples of a letter or sign, an arrow, a bond or a lone pair. They are ' +
      'stored in this browser and used immediately; export them to contribute them to the shared model.',
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
