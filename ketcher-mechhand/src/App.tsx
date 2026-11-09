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
import { TEMPLATES } from './templates/catalog';
import { AboutPanel, type Engine } from './ui/AboutPanel';
import { ConsolidateDialog } from './ui/ConsolidateDialog';
import { ExportDialog } from './ui/ExportDialog';
import { HelpProvider } from './ui/HelpSystem';
import { InkBar, type LastInput } from './ui/InkBar';
import { MecHandBar } from './ui/MecHandBar';
import { TeachPanel } from './ui/TeachPanel';
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
  | { kind: 'export' } | { kind: 'teach' } | { kind: 'about' };

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

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
  const [ketcher, setKetcher] = useState<Ketcher | null>(null);
  const layerRef = useRef<FreehandLayer | null>(null);
  const [freehand, setFreehand] = useState(false);
  const [ink, setInk] = useState({ count: 0, canUndo: false, canRedo: false });
  const strokeCount = ink.count;
  const [pen, setPen] = useState<PenSettings>(loadPenSettings);
  const [tool, setTool] = useState<InkTool>('pen');
  const [lastInput, setLastInput] = useState<LastInput | null>(null);
  const [openStroke, setOpenStroke] = useState(false);
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [userSamples, setUserSamples] = useState<SymbolSample[]>(loadUserSamples);
  const [userElements, setUserElements] = useState<ElementSample[]>(loadElementSamples);
  const model = useMemo(() => buildModel({ userSamples, userElements }), [userSamples, userElements]);
  // Study mode never uses the optional recognition server: nothing may leave the browser.
  const [engine, setEngine] = useState<Engine>(!STUDY && params.get('engine') === 'server' ? 'server' : 'browser');
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
        (l) => setInk({ count: l.strokes.length, canUndo: l.canUndo, canRedo: l.canRedo }),
        {
          onErase: (strokes, source) => studyLog('erase', { strokes, source }),
          onInput: (type, accepted) => setLastInput((p) => ({ type, accepted, n: (p?.n ?? 0) + 1 })),
          onOpenStroke: setOpenStroke,
        },
      );
      layer.setPen(penRef.current);
      layer.setTool(toolRef.current);
      layerRef.current = layer;
      (window as unknown as { mechand: unknown }).mechand = { layer };
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
          setDialog({ kind: 'consolidate', result, issues, smiles: r.smiles, note: `${r.engine} read ${r.smiles} (${Math.round(r.confidence * 100)}%); it will be inserted instead of the in-browser structure.` });
        } else {
          setDialog({ kind: 'consolidate', result, issues, note: `${r.engine} could not read a valid structure; using the in-browser result.` });
        }
        return;
      } catch (e) {
        setDialog({ kind: 'consolidate', result, issues, note: `Recognition server not reachable (${String(e)}); using the in-browser result.` });
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minWidth: 0 }}>
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
          onTemplate={(id) => {
            const t = TEMPLATES.find((x) => x.id === id);
            if (t && ketcher) ketcher.setMolecule(t.ket);
          }}
          onExport={() => setDialog({ kind: 'export' })}
          onTeach={() => setDialog({ kind: 'teach' })}
          onAbout={() => setDialog({ kind: 'about' })}
        />
        {freehand && (
          <InkBar pen={pen} tool={tool} lastInput={lastInput} openStroke={openStroke} onPen={setPen} onTool={setTool} />
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
      {dialog.kind === 'export' && ketcher && <ExportDialog ketcher={ketcher} onClose={() => setDialog({ kind: 'none' })} />}
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
          serverAllowed={!STUDY}
          version={`${pkg.version} (commit ${__MECHAND_COMMIT__})`}
          onClose={() => setDialog({ kind: 'none' })}
        />
      )}
    </HelpProvider>
  );
}
