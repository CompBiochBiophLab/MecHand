/**
 * ConsolidateOverlay.tsx
 * The "is this what you meant?" UI panel.
 *
 * Shown after MolScribe returns a result. Renders:
 *  - The original freehand sketch (semi-transparent)
 *  - The interpreted clean structure (Ketcher mini-preview)
 *  - Confidence badge
 *  - Confirm / Reject / Edit buttons
 *
 * On confirm, the clean structure is inserted into the main Ketcher canvas.
 */

import React, { useEffect, useRef, useState } from 'react';
import { RecognitionResult } from '../recognition/MolScribeClient';

export interface ConsolidateOverlayProps {
  result: RecognitionResult | null;
  sketchDataUrl: string;          // the original freehand strokes as PNG
  onConfirm: (result: RecognitionResult) => void;
  onReject: () => void;
  onEdit: (result: RecognitionResult) => void; // open in Ketcher editor
}

export const ConsolidateOverlay: React.FC<ConsolidateOverlayProps> = ({
  result,
  sketchDataUrl,
  onConfirm,
  onReject,
  onEdit,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  if (!result) return null;

  const pct = Math.round(result.confidence * 100);
  const confidenceColor =
    pct >= 80 ? '#22c55e' : pct >= 55 ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.18s ease',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '24px 28px',
          width: 520,
          maxWidth: '95vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 18, fontWeight: 600, flex: 1 }}>
            Is this what you meant?
          </span>
          <span
            style={{
              background: confidenceColor,
              color: '#fff',
              borderRadius: 20,
              padding: '2px 10px',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {pct}% confidence
          </span>
        </div>

        {/* Side-by-side preview */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {/* Freehand sketch */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
              Your sketch
            </div>
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                overflow: 'hidden',
                background: '#fafafa',
                height: 180,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={sketchDataUrl}
                alt="freehand sketch"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </div>
          </div>

          {/* Interpreted structure */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
              Interpreted structure
            </div>
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                overflow: 'hidden',
                background: '#fff',
                height: 180,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {/* SMILES label */}
              <code
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  background: '#f3f4f6',
                  padding: '2px 6px',
                  borderRadius: 4,
                  maxWidth: '90%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {result.smiles || '—'}
              </code>
              {/* Ketcher mini-viewer would mount here via ref */}
              <KetcherMiniView smiles={result.smiles} />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onReject}
            style={btnStyle('#f3f4f6', '#374151')}
          >
            ✗ Discard
          </button>
          <button
            onClick={() => onEdit(result)}
            style={btnStyle('#eff6ff', '#1d4ed8')}
          >
            ✎ Edit first
          </button>
          <button
            onClick={() => onConfirm(result)}
            style={btnStyle('#f0fdf4', '#15803d')}
          >
            ✓ Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  };
}

/** Minimal inline Ketcher viewer — renders a SMILES as SVG via Ketcher API */
const KetcherMiniView: React.FC<{ smiles: string }> = ({ smiles }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !smiles) return;
    // TODO: integrate with Ketcher's public renderMolecule() API
    // Placeholder until Ketcher integration hook is wired
    ref.current.textContent = smiles ? '(structure preview)' : '';
  }, [smiles]);

  return (
    <div
      ref={ref}
      style={{
        width: '90%',
        height: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: '#9ca3af',
      }}
    />
  );
};
