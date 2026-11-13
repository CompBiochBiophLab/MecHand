/**
 * Read a mechanism from an image: a photo of a drawing on paper, a scan, or a figure
 * from an article or a book. The image is read in this browser (src/image/), the
 * result is shown over the picture and as a clean structure, and the user either
 * inserts it into Ketcher or loads it as ink to correct it with the pen and eraser.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Rich, useT } from '../i18n/i18n';
import { type ImageRecognition, recognizeImage } from '../image/recognizeImage';
import type { SymbolModel } from '../recognition/model';
import type { StrokeRole } from '../recognition/sketch';
import { recognitionTips } from './ConsolidateDialog';
import { Modal, btn } from './Modal';
import { ScenePreview } from './ScenePreview';
import { CheckIcon, ImageIcon, PenIcon } from './icons';

const ROLE_COLOURS: Record<StrokeRole, string> = {
  bond: '#2563eb', arrow: '#dc2626', arrowhead: '#dc2626', text: '#059669', dot: '#059669', ignored: '#9ca3af',
};
/** Images are read at most this size (longest side, px); larger photos are scaled down first. */
const MAX_SIDE = 1600;

/** The pixels of an image file (or clipboard image), scaled down if large, on white. */
export async function imagePixels(file: Blob): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const width = Math.max(1, Math.round(bmp.width * k)), height = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, width, height);
  return { data: img.data, width, height };
}

type State =
  | { step: 'choose' }
  | { step: 'reading'; url: string }
  | { step: 'done'; url: string; size: { width: number; height: number }; rec: ImageRecognition }
  | { step: 'error'; message: string };

export function ImageImportDialog({ model, initialFile, onInsert, onInk, onClose }: {
  model: SymbolModel;
  /** An image already chosen (pasted or dropped on the app). */
  initialFile?: Blob | null;
  onInsert: (rec: ImageRecognition) => void;
  /** Load the strokes as ink (processed-image pixels, and that image's size). */
  onInk: (strokes: { x: number; y: number }[][], size: { width: number; height: number }) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [state, setState] = useState<State>({ step: 'choose' });
  const [overlay, setOverlay] = useState(true);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  const read = useCallback(async (file: Blob) => {
    if (!file.type.startsWith('image/')) {
      setState({ step: 'error', message: t('image.notImage') });
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setState({ step: 'reading', url });
    try {
      const px = await imagePixels(file);
      // Let the "Reading…" state paint before the work starts.
      await new Promise((r) => setTimeout(r, 30));
      const rec = recognizeImage(px.data, px.width, px.height, model.recognizer, { heads: model.heads, style: model.style });
      setState({ step: 'done', url, size: { width: rec.vector.width, height: rec.vector.height }, rec });
    } catch (e) {
      setState({ step: 'error', message: t('image.failed', { error: String(e) }) });
    }
  }, [model, t]);

  useEffect(() => {
    if (initialFile) read(initialFile);
  }, [initialFile, read]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  // Paste an image while the dialog is open.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      read(file);
    };
    window.addEventListener('paste', onPaste, true);
    return () => window.removeEventListener('paste', onPaste, true);
  }, [read]);

  const drop = (
    <div
      data-testid="mechand-image-drop"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) read(f);
      }}
      onClick={() => fileRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? '#2563eb' : '#cbd5e1'}`, background: dragging ? '#eff6ff' : '#f8fafc', borderRadius: 12,
        padding: '28px 16px', textAlign: 'center', cursor: 'pointer', color: '#374151',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6, color: '#2563eb' }}><ImageIcon size={32} /></div>
      <b>{t('image.choose')}</b>
      <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 4 }}>{t('image.chooseHint')}</div>
      <input ref={fileRef} type="file" accept="image/*" hidden data-testid="mechand-image-file"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ''; }} />
    </div>
  );

  return (
    <Modal title={t('image.title')} onClose={onClose} width={900} testId="mechand-image">
      <p style={{ fontSize: 12.5, color: '#4b5563', margin: '0 0 10px' }}><Rich text={t('image.intro')} /></p>
      {state.step === 'choose' && drop}
      {state.step === 'error' && (<>
        <p style={{ color: '#b91c1c' }} data-testid="mechand-image-error">{state.message}</p>
        {drop}
      </>)}
      {(state.step === 'reading' || state.step === 'done') && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px', minWidth: 0 }}>
            <div style={{ position: 'relative', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
              {state.step === 'done' ? (
                <svg viewBox={`0 0 ${state.size.width} ${state.size.height}`} style={{ display: 'block', width: '100%', maxHeight: 360 }} data-testid="mechand-image-overlay">
                  <image href={state.url} width={state.size.width} height={state.size.height} opacity={overlay ? 0.35 : 1} />
                  {overlay && state.rec.vector.strokes.map((s, i) => (
                    <polyline key={i} points={s.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none"
                      stroke={ROLE_COLOURS[state.rec.result.roles[i]]} strokeWidth={Math.max(1.5, state.rec.vector.strokeWidth * 0.8)}
                      strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                </svg>
              ) : (
                <img src={state.url} alt="" style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain', opacity: 0.5 }} />
              )}
              {state.step === 'reading' && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 600, color: '#1d4ed8' }}>
                  {t('image.reading')}
                </div>
              )}
            </div>
            {state.step === 'done' && (
              <label style={{ fontSize: 12, color: '#4b5563', display: 'inline-flex', gap: 6, marginTop: 6 }}>
                <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
                {t('image.overlay')}
              </label>
            )}
          </div>
          {state.step === 'done' && (() => {
            const { result, applied, vector } = state.rec;
            const pct = Math.round(result.confidence * 100);
            const found = { ...vector.found, ...Object.fromEntries(Object.entries(applied).map(([k, v]) => [`applied-${k}`, v])) };
            const tips = recognitionTips(result);
            return (
              <div style={{ flex: '1 1 340px', minWidth: 0 }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, display: 'grid', placeItems: 'center', background: '#fff' }}>
                  <ScenePreview scene={result.scene} width={340} height={220} />
                </div>
                <p style={{ fontSize: 12.5, margin: '8px 0 4px' }} data-testid="mechand-image-summary">
                  {t('consolidate.confidence', { pct })} · {t('consolidate.atoms', { count: result.scene.atoms.length })} ·{' '}
                  {t('consolidate.bonds', { count: result.scene.bonds.length })} · {t('consolidate.arrows', { count: result.scene.arrows.length })}
                </p>
                {Object.keys(found).length > 0 && (
                  <ul style={{ fontSize: 12, color: '#4b5563', margin: '0 0 6px', paddingLeft: 18 }} data-testid="mechand-image-found">
                    {Object.entries(applied).map(([k, v]) => <li key={k}>{t(`image.found.${k}`, { count: v })}</li>)}
                    {vector.found.filledHeads ? <li>{t('image.found.filledHeads', { count: vector.found.filledHeads })}</li> : null}
                  </ul>
                )}
                {tips.length > 0 && (
                  <ul style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 10px 6px 26px', margin: '0 0 8px' }}>
                    {tips.map((tip) => <li key={tip.key}>{t(tip.key, tip.count === undefined ? undefined : { count: tip.count })}</li>)}
                  </ul>
                )}
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>{t('image.editHint')}</p>
              </div>
            );
          })()}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
        {(state.step === 'done' || state.step === 'error') && (
          <button style={btn('#f3f4f6', '#374151')} onClick={() => setState({ step: 'choose' })}>{t('image.another')}</button>
        )}
        {state.step === 'done' && (<>
          <button style={{ ...btn('#eff6ff', '#1d4ed8'), display: 'inline-flex', gap: 6, alignItems: 'center' }} data-testid="mechand-image-ink"
            onClick={() => onInk(state.rec.vector.strokes.map((s) => s.points), state.size)}>
            <PenIcon size={16} />{t('image.asInk')}
          </button>
          <button style={{ ...btn('#16a34a', '#fff'), display: 'inline-flex', gap: 6, alignItems: 'center' }} data-testid="mechand-image-insert" autoFocus
            onClick={() => onInsert(state.rec)}>
            <CheckIcon size={16} />{t('consolidate.insert')}
          </button>
        </>)}
      </div>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>{t('image.privacy')}</p>
    </Modal>
  );
}
