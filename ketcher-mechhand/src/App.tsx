import type { Ketcher } from 'ketcher-core';
import { Editor } from 'ketcher-react';
import { StandaloneStructServiceProvider } from 'ketcher-standalone';
import 'ketcher-react/dist/index.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FreehandLayer } from './ink/FreehandLayer';
import { RecognitionServer } from './recognition/serverClient';
import { type MechanismIssue, checkMechanism } from './recognition/mechanismCheck';
import { buildModel, loadUserSamples, saveUserSamples } from './recognition/model';
import type { SymbolSample } from './recognition/dollarP';
import { type SketchResult, recognizeSketch } from './recognition/sketch';
import { sceneToKet } from './scene/sceneToKet';
import { TEMPLATES } from './templates/catalog';
import { AboutPanel, type Engine } from './ui/AboutPanel';
import { ConsolidateDialog } from './ui/ConsolidateDialog';
import { ExportDialog } from './ui/ExportDialog';
import { HelpProvider } from './ui/HelpSystem';
import { MecHandBar } from './ui/MecHandBar';
import { TeachPanel } from './ui/TeachPanel';

const structServiceProvider = new StandaloneStructServiceProvider();
const params = new URLSearchParams(location.search);

type Dialog =
  | { kind: 'none' }
  | { kind: 'consolidate'; result: SketchResult; issues: MechanismIssue[]; smiles?: string; note?: string }
  | { kind: 'export' } | { kind: 'teach' } | { kind: 'about' };

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Ketcher's drawing area (falls back to the whole editor). */
async function waitForCanvasHost(): Promise<HTMLElement> {
  for (let i = 0; i < 100; i++) {
    const canvas = document.querySelector<HTMLElement>('[data-testid="ketcher-canvas"]');
    if (canvas?.parentElement) return canvas.parentElement;
    await new Promise((r) => setTimeout(r, 50));
  }
  return document.querySelector<HTMLElement>('.Ketcher-root') ?? document.body;
}

export default function App() {
  const [ketcher, setKetcher] = useState<Ketcher | null>(null);
  const layerRef = useRef<FreehandLayer | null>(null);
  const [freehand, setFreehand] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [userSamples, setUserSamples] = useState<SymbolSample[]>(loadUserSamples);
  const model = useMemo(() => buildModel({ userSamples }), [userSamples]);
  const [engine, setEngine] = useState<Engine>(params.get('engine') === 'server' ? 'server' : 'browser');
  const [backendUrl, setBackendUrl] = useState(params.get('server') ?? 'http://localhost:8000');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [backendEngine, setBackendEngine] = useState<string | undefined>();

  // Mount the ink layer once Ketcher is ready.
  useEffect(() => {
    if (!ketcher) return;
    let layer: FreehandLayer | null = null;
    waitForCanvasHost().then((host) => {
      layer = new FreehandLayer(host, (l) => setStrokeCount(l.strokes.length));
      layerRef.current = layer;
      (window as unknown as { mechand: unknown }).mechand = { layer, ketcher };
    });
    return () => layer?.destroy();
  }, [ketcher]);

  useEffect(() => layerRef.current?.setEnabled(freehand), [freehand, strokeCount]);

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
    const result = recognizeSketch(layer.strokes, model.recognizer);
    layer.showRoles(result.roles);
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
    layerRef.current?.clear();
    setDialog({ kind: 'none' });
  }, [dialog, ketcher]);

  // Keyboard: Alt+F toggles freehand; in freehand mode Space recognizes and
  // Ctrl/⌘+Z removes the last stroke (instead of Ketcher's undo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog.kind !== 'none' || isEditable(e.target)) return;
      if (e.altKey && e.code === 'KeyF') {
        e.preventDefault();
        setFreehand((f) => !f);
      } else if (freehand && e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        recognize();
      } else if (freehand && (e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && (layerRef.current?.strokes.length ?? 0) > 0) {
        e.preventDefault();
        e.stopPropagation();
        layerRef.current?.undo();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog, freehand, recognize]);

  const updateSamples = (s: SymbolSample[]) => {
    setUserSamples(s);
    saveUserSamples(s);
  };

  return (
    <HelpProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <MecHandBar
          freehand={freehand}
          strokeCount={strokeCount}
          onFreehand={() => setFreehand((f) => !f)}
          onRecognize={recognize}
          onUndo={() => layerRef.current?.undo()}
          onClear={() => layerRef.current?.clear()}
          onTemplate={(id) => {
            const t = TEMPLATES.find((x) => x.id === id);
            if (t && ketcher) ketcher.setMolecule(t.ket);
          }}
          onExport={() => setDialog({ kind: 'export' })}
          onTeach={() => setDialog({ kind: 'teach' })}
          onAbout={() => setDialog({ kind: 'about' })}
        />
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
      {dialog.kind === 'consolidate' && (
        <ConsolidateDialog
          result={dialog.result}
          issues={dialog.issues}
          engineNote={dialog.note}
          onConfirm={confirm}
          onEdit={() => {
            layerRef.current?.resetColours();
            setDialog({ kind: 'none' });
          }}
          onDiscard={() => {
            layerRef.current?.clear();
            setDialog({ kind: 'none' });
          }}
        />
      )}
      {dialog.kind === 'export' && ketcher && <ExportDialog ketcher={ketcher} onClose={() => setDialog({ kind: 'none' })} />}
      {dialog.kind === 'teach' && (
        <TeachPanel
          samples={userSamples}
          onChange={updateSamples}
          onClose={() => setDialog({ kind: 'none' })}
          classify={(strokes) => model.recognizer.classify(strokes, 1)[0]?.symbol ?? '?'}
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
          onClose={() => setDialog({ kind: 'none' })}
        />
      )}
    </HelpProvider>
  );
}
