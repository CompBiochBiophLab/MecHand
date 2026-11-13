import type { Ketcher } from 'ketcher-core';
import { Editor } from 'ketcher-react';
import { StandaloneStructServiceProvider } from 'ketcher-standalone';
import 'ketcher-react/dist/index.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FreehandLayer } from './ink/FreehandLayer';
import { type InkTool, type PenSettings, loadPenSettings, savePenSettings } from './ink/pen';
import { RecognitionServer } from './recognition/serverClient';
import { type MechanismIssue, checkMechanism } from './recognition/mechanismCheck';
import { buildModel, loadUserSamples, saveUserSamples } from './recognition/model';
import type { SymbolSample } from './recognition/dollarP';
import { type ElementSample, loadElementSamples, saveElementSamples } from './recognition/elements';
import { type SketchResult, recognizeSketch } from './recognition/sketch';
import { sceneToKet } from './scene/sceneToKet';
import { LIBRARY, type InsertMode, type LibraryEntry, insertTemplate } from './templates/library';
import { AboutPanel, type Engine } from './ui/AboutPanel';
import { ConsolidateDialog } from './ui/ConsolidateDialog';
import { ExportDialog } from './ui/ExportDialog';
import { t, useT } from './i18n/i18n';
import { translateKetcher } from './i18n/ketcherTitles';
import { levelUnchosen, templateAllowed, useLevel } from './levels/levels';
import { LevelChooser } from './ui/LevelChooser';
import { PeriodicTable } from './ui/PeriodicTable';
import { HelpProvider } from './ui/HelpSystem';
import { HelpCenter } from './ui/HelpCenter';
import { type TipId, TipToast, markTip, tipShown } from './ui/TipToast';
import { Tour, tourSeen } from './ui/Tour';
import { InkBar, type LastInput } from './ui/InkBar';
import { MecHandBar } from './ui/MecHandBar';
import { useCompact } from './ui/useCompact';
import { TeachPanel } from './ui/TeachPanel';
import { TemplateLibrary } from './ui/TemplateLibrary';
import { StudyPanel, type StudyStatus } from './study/StudyPanel';
import { inkForStudy, resultForStudy, studyLog, studyState } from './study/recorder';
import pkg from '../package.json';

const structServiceProvider = new StandaloneStructServiceProvider();
const params = new URLSearchParams(location.search);
/** User-study mode (estudi/ in the repository): ?study=1[&group=A1]. */
const STUDY = params.get('study') === '1';

type Dialog =
  | { kind: 'none' }
  | { kind: 'consolidate'; result: SketchResult; issues: MechanismIssue[]; smiles?: string; note?: string }
  | { kind: 'export' } | { kind: 'teach' } | { kind: 'about' } | { kind: 'library' };

/**
 * A text field the user is typing in. Ketcher keeps the focus in a hidden clipboard textarea
 * (`data-cliparea`) whenever its canvas has it; that one does not count, or MecHand's shortcuts
 * would never fire after the canvas was used.
 */
const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && !t.hasAttribute('data-cliparea') &&
  (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/**
 * Ketcher's drawing area (falls back to the whole editor). Ketcher renders more
 * than one element with this test id — the drawing area and a hidden 0×0 one that
 * can come first in the page — so take the visible one with the largest area.
 */
async function waitForCanvasHost(): Promise<HTMLElement> {
  for (let i = 0; i < 200; i++) {
    const visible = [...document.querySelectorAll<HTMLElement>('[data-testid="ketcher-canvas"]')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => el.parentElement && r.width > 50 && r.height > 50)
      .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
    if (visible.length) return visible[0].el.parentElement!;
    await new Promise((r) => setTimeout(r, 50));
  }
  return document.querySelector<HTMLElement>('.Ketcher-root') ?? document.body;
}

export default function App() {
  const { lang } = useT();
  const { level, features } = useLevel();
  const [ketcher, setKetcher] = useState<Ketcher | null>(null);
  /** First use: ask the user's level before anything else (never in the study, nor with ?level=). */
  const [chooseLevel, setChooseLevel] = useState(() => !STUDY && levelUnchosen());
  const [periodicOpen, setPeriodicOpen] = useState(false);
  /** Templates of the user's level (src/config/levels.json). */
  const libraryEntries = useMemo(() => LIBRARY.filter((e) => templateAllowed(level, e.id)), [level]);
  const layerRef = useRef<FreehandLayer | null>(null);
  const [freehand, setFreehand] = useState(false);
  const [ink, setInk] = useState({ count: 0, canUndo: false, canRedo: false });
  const strokeCount = ink.count;
  const [pen, setPen] = useState<PenSettings>(loadPenSettings);
  const [tool, setTool] = useState<InkTool>('pen');
  const [lastInput, setLastInput] = useState<LastInput | null>(null);
  const lastInputRef = useRef('');
  const [openStroke, setOpenStroke] = useState(false);
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [helpOpen, setHelpOpen] = useState(false);
  /** Width of the editor column decides whether the toolbars show text (both bars at once). */
  const [columnRef, compact] = useCompact();
  const [tourOpen, setTourOpen] = useState(false);
  const [tip, setTip] = useState<TipId | null>(null);
  /** Show a contextual tip once per browser (never in study mode, never over another tip or the tour). */
  const offerTip = useCallback((id: TipId) => {
    if (STUDY || tipShown(id)) return;
    markTip(id);
    setTip((cur) => cur ?? id);
  }, []);
  const closeTour = useCallback(() => setTourOpen(false), []);
  const ignoredRef = useRef(0);
  const tapsRef = useRef(0);
  const inkCountRef = useRef(0);
  const [userSamples, setUserSamples] = useState<SymbolSample[]>(loadUserSamples);
  const [userElements, setUserElements] = useState<ElementSample[]>(loadElementSamples);
  const model = useMemo(() => buildModel({ userSamples, userElements }), [userSamples, userElements]);
  // Study mode never uses the optional recognition server: nothing may leave the browser. The
  // server is also only offered at the levels that include it.
  const serverAllowed = !STUDY && features.recognitionServer;
  const [engine, setEngine] = useState<Engine>(serverAllowed && params.get('engine') === 'server' ? 'server' : 'browser');
  useEffect(() => {
    if (!serverAllowed) setEngine('browser');
  }, [serverAllowed]);
  const [backendUrl, setBackendUrl] = useState(params.get('server') ?? 'http://localhost:8000');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [backendEngine, setBackendEngine] = useState<string | undefined>();
  const [study, setStudy] = useState<StudyStatus>({ condition: null, teachAllowed: false });
  const onStudyStatus = useCallback((s: StudyStatus) => {
    setStudy((p) => (p.condition === s.condition && p.teachAllowed === s.teachAllowed ? p : s));
  }, []);
  // Study mode: freehand only in the freehand condition (and never outside a task).
  const freehandAllowed = !STUDY || study.condition === 'freehand';
  useEffect(() => {
    if (!freehandAllowed) setFreehand(false);
  }, [freehandAllowed]);
  useEffect(() => studyLog('freehand', { on: freehand }), [freehand]);
  /** The tour turns freehand on for the pen-bar step (and off again after it). */
  const tourFreehand = useCallback((on: boolean) => {
    if (freehandAllowed) setFreehand(on);
  }, [freehandAllowed]);
  useEffect(() => {
    if (freehand && !tourOpen) offerTip('firstFreehand');
  }, [freehand, tourOpen, offerTip]);
  // First visit: offer the guided tour once Ketcher is ready (and the level is chosen).
  useEffect(() => {
    if (ketcher && !chooseLevel && !tourSeen()) offerTip('welcome');
  }, [ketcher, chooseLevel, offerTip]);
  // Ketcher's own tooltips in the interface language (src/i18n/ketcher/).
  const ketcherTitles = useRef<ReturnType<typeof translateKetcher> | null>(null);
  useEffect(() => {
    if (!ketcher) return;
    const root = document.querySelector('.Ketcher-root') ?? document.body;
    const tr = translateKetcher(root, lang);
    ketcherTitles.current = tr;
    return () => {
      tr.stop();
      ketcherTitles.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the language is updated below
  }, [ketcher]);
  useEffect(() => ketcherTitles.current?.setLang(lang), [lang]);
  /** Periodic table → Ketcher's atom tool with that element (freehand off, so the click reaches Ketcher). */
  const pickElement = useCallback((symbol: string) => {
    if (!ketcher) return;
    setFreehand(false);
    try {
      (ketcher.editor as unknown as { tool: (name: string, opts: unknown) => void }).tool('atom', { label: symbol });
    } catch (e) {
      console.error('[MecHand] could not select the atom tool', e);
    }
  }, [ketcher]);
  // Pen settings: kept in this browser, applied to the ink layer, and logged in study tasks.
  const penRef = useRef(pen);
  const toolRef = useRef(tool);
  useEffect(() => {
    penRef.current = pen;
    savePenSettings(pen);
    layerRef.current?.setPen(pen);
  }, [pen]);
  useEffect(() => {
    toolRef.current = tool;
    layerRef.current?.setTool(tool);
    studyLog('tool', { tool });
  }, [tool]);
  useEffect(() => studyLog('pen', { colour: pen.colour, style: pen.style, width: pen.width }), [pen.colour, pen.style, pen.width]);
  useEffect(() => studyLog('input-mode', { mode: pen.input }), [pen.input]);
  // At the start of each freehand task, record the pen in use.
  useEffect(() => {
    if (study.condition === 'freehand') {
      const p = penRef.current;
      studyLog('pen', { colour: p.colour, style: p.style, width: p.width, input: p.input, tool: toolRef.current });
      layerRef.current?.takeRejectedCount();
    }
  }, [study.condition]);

  // Mount the ink layer once, when Ketcher first becomes ready (Ketcher may call
  // onInit again; recreating the layer would drop the ink and race with input).
  const ketcherReady = ketcher !== null;
  useEffect(() => {
    if (!ketcherReady) return;
    let layer: FreehandLayer | null = null;
    waitForCanvasHost().then((host) => {
      layer = new FreehandLayer(
        host,
        (l) => {
          // Several taps in a row from a mouse-type pointer: probably a trackpad without click-and-drag.
          if (l.strokes.length > inkCountRef.current) {
            const s = l.strokes[l.strokes.length - 1].points;
            const len = s.reduce((a, p, i) => (i ? a + Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) : 0), 0);
            tapsRef.current = len < 3 && lastInputRef.current === 'mouse' ? tapsRef.current + 1 : 0;
            if (tapsRef.current >= 3) offerTip('trackpad');
          }
          inkCountRef.current = l.strokes.length;
          setInk({ count: l.strokes.length, canUndo: l.canUndo, canRedo: l.canRedo });
        },
        {
          onErase: (strokes, source) => studyLog('erase', { strokes, source }),
          onInput: (type, accepted) => {
            lastInputRef.current = type;
            setLastInput((p) => ({ type, accepted, n: (p?.n ?? 0) + 1 }));
            ignoredRef.current = accepted || type !== 'touch' ? 0 : ignoredRef.current + 1;
            if (ignoredRef.current >= 3 && penRef.current.input === 'auto') offerTip('ignored');
          },
          onOpenStroke: setOpenStroke,
        },
      );
      layer.setPen(penRef.current);
      layer.setTool(toolRef.current);
      layerRef.current = layer;
      const w = window as unknown as { mechand?: Record<string, unknown> };
      w.mechand = Object.assign(w.mechand ?? {}, { layer });
    });
    return () => layer?.destroy();
  }, [ketcherReady]);

  useEffect(() => layerRef.current?.setEnabled(freehand), [freehand, strokeCount]);

  const undoInk = useCallback(() => {
    const op = layerRef.current?.undo();
    if (op) studyLog('undo-ink', { op });
  }, []);
  const redoInk = useCallback(() => {
    const op = layerRef.current?.redo();
    if (op) studyLog('redo-ink', { op });
  }, []);
  const clearInk = useCallback(() => {
    if (!layerRef.current?.strokes.length) return;
    studyLog('clear-ink');
    layerRef.current.clearInk();
  }, []);

  useEffect(() => {
    if (engine !== 'server') return;
    setBackendOk(null);
    new RecognitionServer(backendUrl).health().then((h) => {
      setBackendOk(h.ok);
      setBackendEngine(h.engine);
    });
  }, [engine, backendUrl]);

  const recognize = useCallback(async () => {
    const layer = layerRef.current;
    if (!layer || layer.strokes.length === 0) return;
    const result = recognizeSketch(layer.strokes, model.recognizer, { heads: model.heads, style: model.style });
    layer.showRoles(result.roles);
    if (studyState.recorder) {
      studyLog('recognize', { ink: inkForStudy(layer.strokes, layer.strokeTimes, studyState.recorder.t0), result: resultForStudy(result) });
    }
    const issues = checkMechanism(result.scene, result.arrows);
    if (engine === 'server') {
      try {
        const r = await new RecognitionServer(backendUrl).recognize(await layer.toPng());
        if (r.valid) {
          setDialog({ kind: 'consolidate', result, issues, smiles: r.smiles, note: t('consolidate.serverRead', { engine: r.engine, smiles: r.smiles, pct: Math.round(r.confidence * 100) }) });
        } else {
          setDialog({ kind: 'consolidate', result, issues, note: t('consolidate.serverInvalid', { engine: r.engine }) });
        }
        return;
      } catch (e) {
        setDialog({ kind: 'consolidate', result, issues, note: t('consolidate.serverDown', { error: String(e) }) });
        return;
      }
    }
    setDialog({ kind: 'consolidate', result, issues });
  }, [model, engine, backendUrl]);

  const confirm = useCallback(async () => {
    if (dialog.kind !== 'consolidate' || !ketcher) return;
    const { result, smiles } = dialog;
    if (smiles) {
      await ketcher.addFragment(smiles);
      const { arrows, pluses } = result.scene;
      if (arrows.length || pluses.length) await ketcher.addFragment(sceneToKet({ atoms: [], bonds: [], arrows, pluses }));
    } else {
      await ketcher.addFragment(sceneToKet(result.scene));
    }
    // Study: the canvas right after inserting, to count the corrections made afterwards with Ketcher.
    if (studyState.recorder && studyState.task) {
      let ket: string | null = null;
      try {
        ket = await ketcher.getKet();
      } catch {
        ket = null;
      }
      studyLog('insert', { engine: smiles ? 'server' : 'browser', ket });
    }
    layerRef.current?.clear();
    setDialog({ kind: 'none' });
  }, [dialog, ketcher]);

  // Keyboard. Alt+F toggles freehand. In freehand mode: Space recognizes, P/E pick
  // the pen or the eraser, Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y) undo and redo ink
  // (instead of Ketcher's undo), Esc drops an open trackpad stroke.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        setHelpOpen((o) => !o);
        return;
      }
      if (dialog.kind !== 'none' || isEditable(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const take = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.altKey && e.code === 'KeyF') {
        e.preventDefault();
        if (freehandAllowed) setFreehand((f) => !f);
        return;
      }
      // Ctrl/⌘+K: the template library (not in study mode, where templates are off).
      if (mod && e.code === 'KeyK' && !STUDY) {
        e.preventDefault();
        e.stopPropagation();
        setDialog({ kind: 'library' });
        return;
      }
      if (!freehand) return;
      const layer = layerRef.current;
      if (e.code === 'Space' && !mod) {
        take();
        recognize();
      } else if (e.code === 'Escape' && layer?.hasOpenStroke) {
        take();
        layer.cancelInput();
      } else if (!mod && !e.altKey && (e.code === 'KeyP' || e.code === 'KeyE')) {
        take();
        setTool(e.code === 'KeyE' ? 'eraser' : 'pen');
      } else if (mod && ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY') && layer?.canRedo) {
        take();
        redoInk();
      } else if (mod && e.code === 'KeyZ' && !e.shiftKey && layer?.canUndo) {
        take();
        undoInk();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog, freehand, recognize, freehandAllowed, undoInk, redoInk]);

  const updateSamples = (s: SymbolSample[]) => {
    setUserSamples(s);
    saveUserSamples(s);
  };
  const updateElements = (e: ElementSample[]) => {
    setUserElements(e);
    saveElementSamples(e);
  };

  return (
    <HelpProvider>
      <div style={{ display: 'flex', height: '100%' }}>
      <div ref={columnRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minWidth: 0 }}>
        <MecHandBar
          freehand={freehand}
          strokeCount={strokeCount}
          canUndo={ink.canUndo}
          canRedo={ink.canRedo}
          onFreehand={() => setFreehand((f) => !f)}
          onRecognize={recognize}
          onUndo={undoInk}
          onRedo={redoInk}
          onClear={clearInk}
          disabled={STUDY ? { freehand: !freehandAllowed, templates: true, teach: !study.teachAllowed } : undefined}
          hidden={{ teach: !STUDY && !features.teach }}
          onPeriodic={!STUDY && features.periodicTable ? () => { setPeriodicOpen((o) => !o); setHelpOpen(false); } : undefined}
          periodicOpen={periodicOpen}
          onLibrary={() => setDialog({ kind: 'library' })}
          onExport={() => setDialog({ kind: 'export' })}
          onTeach={() => setDialog({ kind: 'teach' })}
          onAbout={() => setDialog({ kind: 'about' })}
          onHelp={() => { setHelpOpen((o) => !o); setPeriodicOpen(false); }}
          compact={compact}
        />
        {freehand && (
          <InkBar pen={pen} tool={tool} lastInput={lastInput} openStroke={openStroke} onPen={setPen} onTool={setTool} compact={compact} />
        )}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <Editor
            staticResourcesUrl={import.meta.env.BASE_URL}
            structServiceProvider={structServiceProvider as never}
            disableMacromoleculesEditor
            errorHandler={(message: string) => console.error('[Ketcher]', message)}
            onInit={(k: Ketcher) => {
              (window as unknown as { ketcher: Ketcher }).ketcher = k;
              setKetcher(k);
            }}
          />
        </div>
      </div>
      {helpOpen && (
        <HelpCenter
          context={{ dialog: dialog.kind, freehand, strokes: strokeCount, lastInput, study: STUDY }}
          onClose={() => setHelpOpen(false)}
          onTour={() => { setHelpOpen(false); setTourOpen(true); }}
        />
      )}
      {periodicOpen && !helpOpen && <PeriodicTable onClose={() => setPeriodicOpen(false)} onUse={pickElement} />}
      {STUDY && (
        <StudyPanel
          ketcher={ketcher}
          getLayer={() => layerRef.current}
          appVersion={`${pkg.version}+${__MECHAND_COMMIT__}`}
          modelVersion={model.version}
          teach={{ samples: userSamples, elements: userElements }}
          onOpenTeach={() => setDialog({ kind: 'teach' })}
          onClearTeach={() => { updateSamples([]); updateElements([]); }}
          onStatus={onStudyStatus}
        />
      )}
      </div>
      {dialog.kind === 'consolidate' && (
        <ConsolidateDialog
          result={dialog.result}
          issues={dialog.issues}
          engineNote={dialog.note}
          onConfirm={confirm}
          onEdit={() => {
            studyLog('keep-drawing');
            layerRef.current?.resetColours();
            setDialog({ kind: 'none' });
          }}
          onDiscard={() => {
            studyLog('discard');
            layerRef.current?.resetColours();
            layerRef.current?.clearInk();
            setDialog({ kind: 'none' });
          }}
        />
      )}
      {dialog.kind === 'export' && ketcher && <ExportDialog ketcher={ketcher} formats={STUDY ? undefined : features.export} onClose={() => setDialog({ kind: 'none' })} />}
      {dialog.kind === 'library' && ketcher && (
        <TemplateLibrary
          onInsert={(entry: LibraryEntry, mode: InsertMode) => insertTemplate(ketcher, entry, mode)}
          onClose={() => setDialog({ kind: 'none' })}
          convert={async (notation) => (await ketcher.indigo.convert(notation, { outputFormat: 'chemical/x-indigo-ket' as never })).struct}
          online={!STUDY && features.onlineLookup}
          entries={libraryEntries}
          note={libraryEntries.length < LIBRARY.length ? t('level.basicTemplates', { level, count: libraryEntries.length }) : undefined}
        />
      )}
      {dialog.kind === 'teach' && (
        <TeachPanel
          samples={userSamples}
          elements={userElements}
          model={model}
          onChange={updateSamples}
          onElements={updateElements}
          onClose={() => setDialog({ kind: 'none' })}
        />
      )}
      {dialog.kind === 'about' && (
        <AboutPanel
          model={model}
          engine={engine}
          backendUrl={backendUrl}
          backendOk={backendOk}
          backendEngine={backendEngine}
          onEngine={setEngine}
          onBackendUrl={setBackendUrl}
          serverAllowed={serverAllowed}
          lockedKey={STUDY ? 'about.engineLocked' : 'about.engineLevel'}
          version={`${pkg.version} (commit ${__MECHAND_COMMIT__})`}
          onClose={() => setDialog({ kind: 'none' })}
        />
      )}
      {chooseLevel && <LevelChooser onClose={() => setChooseLevel(false)} />}
      {tourOpen && <Tour onClose={closeTour} onFreehand={tourFreehand} />}
      {tip && !tourOpen && (
        <TipToast
          id={tip}
          onClose={() => setTip(null)}
          onHelp={() => { setTip(null); setHelpOpen(true); }}
          onAction={() => {
            if (tip === 'welcome') setTourOpen(true);
            if (tip === 'ignored') setPen((p) => ({ ...p, input: 'touch' }));
            if (tip === 'trackpad') setPen((p) => ({ ...p, input: 'trackpad' }));
            setTip(null);
          }}
        />
      )}
    </HelpProvider>
  );
}
