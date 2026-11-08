/**
 * KetcherPlugin.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Entry point that wires the MecHand freehand layer into Ketcher.
 *
 * Usage — in your Ketcher bootstrap (e.g. App.tsx or index.tsx):
 *
 *   import { mountMecHandPlugin } from './plugins/freehand/KetcherPlugin';
 *   const editor = await ketcher.editor();   // Ketcher Editor instance
 *   mountMecHandPlugin(editor);
 *
 * The plugin:
 *   1. Injects a transparent SVG overlay above Ketcher's canvas.
 *   2. Attaches StylusManager for unified pointer-event capture.
 *   3. After consolidation, writes the confirmed structure back via
 *      editor.struct.fromSmiles() / editor.render().
 *   4. Mounts the ConsolidateOverlay React component into a portal <div>.
 *   5. Mounts the HelpSystem React context around Ketcher's toolbar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { StylusManager, StrokePoint } from './StylusManager';
import { StrokeClassifier, ClassifiedStroke } from './StrokeClassifier';
import { MolScribeClient } from '../recognition/MolScribeClient';
import { ConsolidateOverlay, RecognitionResult } from '../consolidate/ConsolidateOverlay';
import { HelpProvider } from '../help/HelpSystem';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal interface for the parts of the Ketcher Editor we use. */
interface KetcherEditor {
  /** The host DOM element Ketcher rendered into */
  domElement: HTMLElement;
  /** Load a SMILES string onto the canvas */
  setMolecule(smiles: string): Promise<void>;
  /** Zoom / pan so the new structure is visible */
  zoomToContent(): void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const OVERLAY_ID = 'mechhand-stroke-overlay';
const PORTAL_ID  = 'mechhand-portal';

// ─── Main mount function ──────────────────────────────────────────────────────

export function mountMecHandPlugin(editor: KetcherEditor): () => void {
  const host = editor.domElement;

  // 1 ── SVG overlay (transparent, pointer-events: all) ─────────────────────
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = OVERLAY_ID;
  svg.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: all;
    z-index: 10;
  `;

  // Make host position:relative if it isn't already
  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative';
  }
  host.appendChild(svg);

  // 2 ── Portal div for React overlays ─────────────────────────────────────
  const portal = document.createElement('div');
  portal.id = PORTAL_ID;
  portal.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:20;';
  host.appendChild(portal);

  // 3 ── Collect strokes in memory ─────────────────────────────────────────
  const pendingStrokes: StrokePoint[][] = [];
  let currentPath: SVGPathElement | null = null;

  // 4 ── StylusManager ─────────────────────────────────────────────────────
  const stylusManager = new StylusManager(svg, {
    onStrokeStart: () => {
      currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      currentPath.setAttribute('fill', 'none');
      currentPath.setAttribute('stroke', 'var(--mechhand-ink, #1a1a2e)');
      currentPath.setAttribute('stroke-width', '2');
      currentPath.setAttribute('stroke-linecap', 'round');
      currentPath.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(currentPath);
    },

    onStrokeUpdate: (pts: StrokePoint[]) => {
      if (!currentPath || pts.length < 2) return;
      const d = pts.reduce((acc, p, i) =>
        i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
      currentPath.setAttribute('d', d);
    },

    onStrokeEnd: (pts: StrokePoint[]) => {
      pendingStrokes.push(pts);
      currentPath = null;
    },

    onConsolidate: () => triggerConsolidation(),
  });

  stylusManager.attach();

  // 5 ── MolScribe client ───────────────────────────────────────────────────
  const client = new MolScribeClient('http://localhost:8000');

  // 6 ── Consolidation flow ─────────────────────────────────────────────────
  let consolidateRoot = createRoot(portal);

  async function triggerConsolidation(): Promise<void> {
    if (pendingStrokes.length === 0) return;

    // Classify strokes
    const classifier = new StrokeClassifier();
    const classified: ClassifiedStroke[] = pendingStrokes.map(pts => ({
      pts,
      ...classifier.classifyStroke(pts),
    }));

    // Rasterise and send to backend (if available)
    let result: RecognitionResult | null = null;
    if (await client.isAvailable()) {
      try {
        result = await client.recognize(svg) as RecognitionResult;
      } catch (e) {
        console.warn('[MecHand] Recognition failed:', e);
      }
    }

    if (!result) {
      // No backend: skip consolidation, leave strokes on canvas for manual edit
      return;
    }

    // Show ConsolidateOverlay
    consolidateRoot.render(
      React.createElement(HelpProvider, null,
        React.createElement(ConsolidateOverlay, {
          sketchSvgElement: svg.cloneNode(true) as SVGSVGElement,
          result,
          onConfirm: async (smiles: string) => {
            // Write confirmed SMILES into Ketcher canvas
            await editor.setMolecule(smiles);
            editor.zoomToContent();
            clearOverlay();
          },
          onEdit: () => {
            // Dismiss overlay; user edits the raw strokes
            clearOverlay();
          },
          onDiscard: () => {
            clearOverlay();
            clearStrokes();
          },
        })
      )
    );
  }

  function clearOverlay(): void {
    consolidateRoot.render(null);
  }

  function clearStrokes(): void {
    pendingStrokes.length = 0;
    // Remove stroke paths from SVG overlay
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  // 7 ── Keyboard shortcut: Space = consolidate now ─────────────────────────
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.target || (e.target as HTMLElement).tagName !== 'INPUT') {
      e.preventDefault();
      triggerConsolidation();
    }
  };
  window.addEventListener('keydown', onKey);

  // 8 ── Teardown ───────────────────────────────────────────────────────────
  return function unmount() {
    stylusManager.detach();
    window.removeEventListener('keydown', onKey);
    consolidateRoot.unmount();
    svg.remove();
    portal.remove();
  };
}
