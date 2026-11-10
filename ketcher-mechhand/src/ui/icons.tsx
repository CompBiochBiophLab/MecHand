/**
 * Toolbar icons: 24×24 line drawings in the current text colour, drawn for
 * MecHand (no icon font, no network). Every icon takes an optional size.
 */

import type { ReactNode } from 'react';

export interface IconProps {
  size?: number;
  title?: string;
}

function Icon({ size = 18, title, children, filled = false }: IconProps & { children: ReactNode; filled?: boolean }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/** Ballpoint pen: freehand drawing. */
export const PenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15.2 4.3a2.2 2.2 0 0 1 3.1 0l1.4 1.4a2.2 2.2 0 0 1 0 3.1L9 19.5l-4.9 1.4 1.4-4.9z" />
    <path d="M13.5 6l4.5 4.5" />
    <path d="M5.5 16l2.5 2.5" />
  </Icon>
);

/** Eraser: removes whole ink strokes. */
export const EraserIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.7 14.6l9.4-9.4a2 2 0 0 1 2.8 0l3.5 3.5a2 2 0 0 1 0 2.8L12 19.9H8.6a2 2 0 0 1-1.4-.6l-2.5-2.5a1.6 1.6 0 0 1 0-2.2z" />
    <path d="M9.3 10l5.9 5.9" />
    <path d="M12 19.9h8.5" />
  </Icon>
);

/** Recognize: read the ink. */
export const RecognizeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4h3" />
    <path d="M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3" />
    <path d="M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3" />
    <path d="M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3" />
    <path d="M8 12.3l2.6 2.6L16 9.5" />
  </Icon>
);

export const UndoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);

export const RedoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16" />
    <path d="M9.5 7V4.5h5V7" />
    <path d="M6 7l1 12.2A1.9 1.9 0 0 0 8.9 21h6.2a1.9 1.9 0 0 0 1.9-1.8L18 7" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
);

export const ExportIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11" />
    <path d="M7.5 10.5L12 15l4.5-4.5" />
    <path d="M5 20h14" />
  </Icon>
);

/** Teach: handwriting sample (a letter being written). */
export const TeachIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 17c2.2-7 4.4-9.5 5.6-8.4 1.4 1.3-2.3 8.4-.6 8.6 1.4.2 2.6-4 4-3.8 1.2.2.4 3.3 1.6 3.4 1 .1 2-1.2 2.6-2" />
    <path d="M17.3 5.6a1.7 1.7 0 0 1 2.4 2.4l-5.3 5.3-3 .6.6-3z" />
  </Icon>
);

/** Template library: a book of structures (a hexagon on the cover). */
export const LibraryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
    <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" />
    <path d="M12 6.2l2.8 1.6v3.3L12 12.7l-2.8-1.6V7.8z" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <path d="M12 7.6v.1" />
  </Icon>
);

/** A finger (touch input). */
export const TouchIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 12.5V5a1.5 1.5 0 0 1 3 0v6" />
    <path d="M12 10.5a1.5 1.5 0 0 1 3 0v1" />
    <path d="M15 11.2a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.8a6 6 0 0 1-4.6-2.2l-2.4-3a1.6 1.6 0 0 1 2.4-2.1L9 15" />
  </Icon>
);

/** Palm rejection: a hand crossed out. */
export const PalmOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 12.5V5a1.5 1.5 0 0 1 3 0v6" />
    <path d="M12 10.5a1.5 1.5 0 0 1 3 0v1" />
    <path d="M15 11.2a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.8a6 6 0 0 1-4.6-2.2l-2.4-3a1.6 1.6 0 0 1 2.4-2.1L9 15" />
    <path d="M3.5 3.5l17 17" />
  </Icon>
);

export const MouseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="3" width="12" height="18" rx="6" />
    <path d="M12 7v3.5" />
  </Icon>
);

/** Trackpad: a rounded pad with a finger path. */
export const TrackpadIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M7 15c2-3.5 4-4.5 6-3s3.5.5 4-2" strokeDasharray="0.1 2.6" />
    <circle cx="17" cy="10" r="1.2" />
  </Icon>
);

/** Automatic input detection. */
export const AutoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19l5.5-14h1L16 19" />
    <path d="M6.2 13.5h8.6" />
    <path d="M18.5 3.5v3M17 5h3" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

export const GlobeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5s1.1-6.1 3.5-8.5z" />
  </Icon>
);

/** Help centre: a life buoy. */
export const HelpIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M6 6l3.5 3.5M14.5 14.5L18 18M18 6l-3.5 3.5M9.5 14.5L6 18" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} filled={filled}>
    <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5 5" />
  </Icon>
);

/** The MecHand mark: a benzene ring drawn by a pen stroke. */
export const MecHandLogo = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={{ flexShrink: 0, display: 'block' }}>
    <path d="M14 4.5l9.5 5.5v11L14 26.5 4.5 21V10z" fill="none" stroke="#1d4ed8" strokeWidth={2.2} strokeLinejoin="round" />
    <circle cx="14" cy="15.5" r="5" fill="none" stroke="#1d4ed8" strokeWidth={1.8} />
    <path d="M20 27.5c3-1.2 5.5-4 7.5-8.5" fill="none" stroke="#dc2626" strokeWidth={2} strokeLinecap="round" />
    <path d="M24.4 19.6l3.1-.6.9 3" fill="none" stroke="#dc2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
