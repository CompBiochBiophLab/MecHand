/**
 * Study mode (?study=1): a side panel that takes a participant through a session
 * of the user study (estudi/ in the repository) — consent check and a short
 * questionnaire, Teach training, the drawing tasks in two counterbalanced blocks,
 * the System Usability Scale after each block, open questions, and the download
 * of the session file. Everything stays in the browser (see recorder.ts).
 */

import type { Ketcher } from 'ketcher-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ElementSample } from '../recognition/elements';
import type { SymbolSample } from '../recognition/dollarP';
import type { FreehandLayer } from '../ink/FreehandLayer';
import { Rich, type T, useT } from '../i18n/i18n';
import { btn } from '../ui/Modal';
import { FIRST_COUNTRY_COUNT, countryOptions } from './countries';
import { type StudyEnvironment, detectEnvironment } from './environment';
import {
  type Device, type Participant, type Role, type StudyComments, StudyRecorder, newParticipantCode, studyState,
} from './recorder';
import { type Condition, GROUPS, type Group, stimulus, tasksFor } from './tasks';

const params = new URLSearchParams(location.search);

const DEVICES: Device[] = ['tauleta-llapis', 'tauleta-dit', 'ordinador-llapis', 'ordinador-tactil', 'ordinador-trackpad', 'ordinador-ratoli', 'altre'];

/**
 * System Usability Scale (Brooke, 1996): the ten items, in the interface language (study.sus.item1…10;
 * English: Brooke's wording; Catalan: the study's translation; see estudi/08-questionaris.md).
 */
export const susItems = (t: T) => Array.from({ length: 10 }, (_, i) => t(`study.sus.item${i + 1}`));

/** Short description of the recorded environment, in the interface language. */
function describeEnv(e: StudyEnvironment, t: T): string {
  const v = (x: { name: string; major: number | null }) => (x.major ? `${x.name} ${x.major}` : x.name);
  return [
    `${t('study.env.browser')}: ${v(e.browser)}`,
    `${t('study.env.os')}: ${v(e.os)}`,
    `${t('study.env.architecture')}: ${e.architecture ?? t('study.env.notAvailable')}`,
    `${t('study.env.screen')}: ${e.screen.width}×${e.screen.height} (×${e.screen.pixelRatio})`,
    `${t('study.env.touchPoints')}: ${e.maxTouchPoints}`,
  ].join(' · ');
}

export interface StudyStatus {
  /** Condition of the running task (null between tasks). */
  condition: Condition | null;
  /** Teach may be opened (training phase only). */
  teachAllowed: boolean;
}

const box = { border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 10, background: '#fff' };
const label = { display: 'block', fontSize: 12, fontWeight: 600, margin: '8px 0 3px' } as const;
const field = { width: '100%', fontSize: 13, padding: 4 } as const;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StudyPanel({ ketcher, getLayer, appVersion, modelVersion, teach, onOpenTeach, onClearTeach, onStatus }: {
  ketcher: Ketcher | null;
  getLayer: () => FreehandLayer | null;
  appVersion: string;
  modelVersion: string;
  teach: { samples: SymbolSample[]; elements: ElementSample[] };
  onOpenTeach: () => void;
  onClearTeach: () => void;
  onStatus: (s: StudyStatus) => void;
}) {
  const { t, lang } = useT();
  const [rec, setRec] = useState<StudyRecorder | null>(() => StudyRecorder.restore());
  const [, force] = useState(0);
  const rerender = () => force((x) => x + 1);
  const [env, setEnv] = useState<StudyEnvironment | null>(null);
  const [running, setRunning] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [tick, setTick] = useState(0);
  const [fileText, setFileText] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    detectEnvironment().then(setEnv);
  }, []);

  // Keep the shared state (used by the app to log recognition) in sync.
  const session = rec?.session;
  const progress = session?.progress;
  const task = session && progress?.phase === 'tasks' ? session.tasks[progress.task] : null;
  useEffect(() => {
    studyState.recorder = rec;
    studyState.task = running ? task : null;
    onStatus({ condition: running && task ? task.condition : null, teachAllowed: progress?.phase === 'teach' });
  }, [rec, running, task, progress?.phase, onStatus]);

  // Which kinds of pointer the participant uses (pen, touch, mouse).
  useEffect(() => {
    if (!rec) return;
    const on = (e: PointerEvent) => rec.notePointer(e.pointerType);
    window.addEventListener('pointerdown', on, true);
    return () => window.removeEventListener('pointerdown', on, true);
  }, [rec]);

  // Task clock.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const clearCanvas = async () => {
    getLayer()?.clear();
    try {
      await ketcher?.setMolecule('');
    } catch {
      /* empty canvas already */
    }
  };

  if (!rec || !session || !progress) {
    return <StartForm env={env} hasTeachSamples={teach.samples.length + teach.elements.length > 0}
      onStart={(group, participant, share, publish) => {
        if (!env) return;
        // Samples already in this browser may be someone else's: each session starts from the shared model.
        onClearTeach();
        const r = StudyRecorder.create({
          appVersion, modelVersion, uiLanguage: lang, code: newParticipantCode(), group, participant,
          environment: { ...env, pointerTypes: [] }, tasks: tasksFor(group),
          shareTeachSamples: share, publishTeachSamples: share && publish,
        });
        r.log('session-start');
        setRec(r);
      }} />;
  }

  const go = (phase: typeof progress.phase, taskIndex = progress.task) => {
    rec.setProgress({ phase, task: taskIndex });
    rerender();
  };

  const finishTask = async (skipped: boolean) => {
    if (!task) return;
    let ket: string | null = null;
    try {
      ket = (await ketcher?.getKet()) ?? null;
    } catch {
      ket = null;
    }
    const layer = getLayer();
    rec.log(skipped ? 'task-skip' : 'task-end', task.id, {
      seconds: rec.elapsed(task.id), ket, pendingInkStrokes: layer?.strokes.length ?? 0,
      ignoredContacts: layer?.takeRejectedCount() ?? 0,
    });
    setRunning(false);
    studyState.task = null;
    await clearCanvas();
    const next = progress.task + 1;
    const blockEnds = next >= session.tasks.length || session.tasks[next].block !== task.block;
    if (blockEnds) go('sus', next);
    else go('tasks', next);
  };

  return (
    <aside data-testid="mechand-study" style={{ width: 360, flexShrink: 0, overflowY: 'auto', background: '#f9fafb', borderLeft: '1px solid #e5e7eb', padding: 10, fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <b>{t('study.title')}</b>
        {progress.phase === 'done' ? (
          <span style={{ fontFamily: 'monospace', fontSize: 14 }} title={t('study.codeTitle')}>{session.code}</span>
        ) : (
          <button type="button" onClick={() => setShowCode((v) => !v)} title={t('study.codeHidden')}
            style={{ fontFamily: 'monospace', fontSize: 13, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, cursor: 'pointer', padding: '1px 6px' }}>
            {showCode ? session.code : 'MH-•••••'}
          </button>
        )}
      </div>

      {progress.phase === 'teach' && (
        <div style={box}>
          <b>{t('study.teach.title')}</b>
          <p><Rich text={t('study.teach.intro')} /></p>
          <ul style={{ paddingLeft: 18, margin: '4px 0' }}>
            <li><Rich text={t('study.teach.letters', { tab: t('teach.letters') })} /></li>
            <li><Rich text={t('study.teach.arrows', { tab: t('teach.group.arrows') })} /></li>
            <li><Rich text={t('study.teach.electrons', { tab: t('teach.group.electrons') })} /></li>
          </ul>
          <p style={{ color: '#4b5563' }}>{t('study.teach.reading')}</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={btn('#1d4ed8', '#fff')} onClick={() => { rec.log('teach-open'); onOpenTeach(); }}>{t('study.teach.open')}</button>
            <button style={btn('#16a34a', '#fff')} data-testid="study-teach-done" onClick={() => {
              rec.log('teach-end', undefined, { letters: teach.samples.length, elements: teach.elements.length });
              go('tasks', 0);
            }}>{t('study.teach.done')}</button>
          </div>
        </div>
      )}

      {progress.phase === 'tasks' && task && (() => {
        const s = stimulus(task.stimulus);
        const inBlock = session.tasks.filter((x) => x.block === task.block);
        const k = inBlock.findIndex((x) => x.id === task.id);
        const secs = running ? rec.elapsed(task.id) : 0;
        void tick;
        return (
          <div style={box}>
            <div style={{ fontSize: 12, color: '#4b5563' }}>{t('study.task.position', { block: task.block, k: k + 1, n: inBlock.length })}{task.practice ? t('study.task.practice') : ''}</div>
            <div data-testid="study-condition" style={{
              margin: '6px 0', padding: '4px 8px', borderRadius: 6, fontWeight: 600,
              background: task.condition === 'freehand' ? '#dbeafe' : '#fef3c7', color: task.condition === 'freehand' ? '#1e3a8a' : '#78350f',
            }}>{t(`study.condition.${task.condition}`)}</div>
            <p style={{ margin: '6px 0' }} data-testid="study-task-text">{t(`study.stimulus.${s.id}`) === `study.stimulus.${s.id}` ? s.task : t(`study.stimulus.${s.id}`)}</p>
            {task.condition === 'ketcher' && (
              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px' }} data-testid="study-ketcher-tip">
                {t('study.task.ketcherTip')}
              </p>
            )}
            <img src={`${import.meta.env.BASE_URL}study/${s.file}`} alt={s.source.title}
              onClick={() => setZoom(true)} style={{ width: '100%', cursor: 'zoom-in', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff' }} />
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
              {s.source.title.replace(/^File:/, '')} · {s.source.author} · {s.source.license}
              {s.source.license.startsWith('CC') ? ` · ${t('study.task.converted')}` : ''}
            </div>
            {!running ? (
              <button style={{ ...btn('#1d4ed8', '#fff'), marginTop: 8, width: '100%' }} data-testid="study-start-task" onClick={async () => {
                await clearCanvas();
                rec.startTask(task.id);
                setRunning(true);
              }}>{t('study.task.start')}</button>
            ) : (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                  {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button style={{ ...btn('#16a34a', '#fff'), flex: 1 }} data-testid="study-finish-task" onClick={() => finishTask(false)}>{t('study.task.finish')}</button>
                  <button style={btn('#f3f4f6', '#374151')} onClick={() => confirm(t('study.task.confirmSkip')) && finishTask(true)}>{t('study.task.skip')}</button>
                </div>
              </div>
            )}
            {zoom && (
              <div onClick={() => setZoom(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
                <img src={`${import.meta.env.BASE_URL}study/${s.file}`} alt={s.source.title} style={{ maxWidth: '95vw', maxHeight: '90vh', background: '#fff', borderRadius: 6 }} />
              </div>
            )}
          </div>
        );
      })()}

      {progress.phase === 'sus' && (() => {
        const last = session.tasks[progress.task - 1];
        return <SusForm condition={last.condition} onDone={(answers) => {
          session.sus[last.condition] = answers;
          rec.log('sus', undefined, { condition: last.condition, answers });
          go(progress.task >= session.tasks.length ? 'final' : 'tasks', progress.task);
        }} />;
      })()}

      {progress.phase === 'final' && (
        <FinalForm onDone={(comments) => {
          session.comments = comments;
          setFileText(rec.finish(teach));
          go('done');
        }} />
      )}

      {progress.phase === 'done' && (
        <div style={box}>
          <b>{t('study.done.thanks')}</b>
          <p>{t('study.done.instructions')}</p>
          <button style={{ ...btn('#1d4ed8', '#fff'), width: '100%' }} data-testid="study-download" onClick={() => {
            const text = fileText ?? rec.finish(teach);
            setFileText(text);
            download(`mechand-estudi-${session.code}.json`, text);
          }}>{t('study.done.download', { file: `mechand-estudi-${session.code}.json` })}</button>
          <p style={{ fontSize: 12, background: '#f3f4f6', padding: 6, borderRadius: 6 }} data-testid="study-choices">
            <Rich text={t('study.done.choices', {
              share: session.shareTeachSamples ? t('study.done.yes') : t('study.done.no'),
              publish: session.publishTeachSamples ? t('study.done.yes') : t('study.done.no'),
            })} />
          </p>
          <p style={{ fontSize: 12, color: '#4b5563' }}>{t('study.done.downloadsCopy')}</p>
          <p style={{ fontSize: 12, color: '#4b5563' }}><Rich text={t('study.done.keepCode', { code: session.code })} /></p>
          <button style={{ ...btn('#fef2f2', '#b91c1c'), width: '100%' }} data-testid="study-clear" onClick={() => {
            if (!confirm(t('study.done.confirmClear'))) return;
            StudyRecorder.clearStorage();
            onClearTeach();
            studyState.recorder = null;
            setFileText(null);
            setRec(null);
          }}>{t('study.done.clear')}</button>
        </div>
      )}

      <details style={{ fontSize: 11, color: '#6b7280' }}>
        <summary>{t('study.recorded.summary')}</summary>
        <p>{t('study.recorded.text', { environment: describeEnv(session.environment, t), pointers: session.environment.pointerTypes.join(', ') || '—' })}</p>
      </details>
    </aside>
  );
}

function StartForm({ env, hasTeachSamples, onStart }: {
  env: StudyEnvironment | null;
  hasTeachSamples: boolean;
  onStart: (group: Group, participant: Participant, shareTeach: boolean, publishTeach: boolean) => void;
}) {
  const fromUrl = params.get('group') as Group | null;
  const [group, setGroup] = useState<Group | ''>(fromUrl && GROUPS.includes(fromUrl) ? fromUrl : '');
  const [role, setRole] = useState<Role | ''>('');
  const [course, setCourse] = useState('');
  const [device, setDevice] = useState<Device | ''>('');
  const [country, setCountry] = useState<string | null>(null);
  const [hand, setHand] = useState('');
  const [experience, setExperience] = useState('');
  const [share, setShare] = useState(false);
  const [publish, setPublish] = useState(false);
  const [consent, setConsent] = useState(false);
  const { t, lang } = useT();
  const countries = useMemo(() => countryOptions(lang), [lang]);
  const ready = group && role && (role === 'professorat' || course) && device && country !== null && experience && consent && env;
  const ref = useRef<HTMLDivElement>(null);

  return (
    <aside data-testid="mechand-study" style={{ width: 360, flexShrink: 0, overflowY: 'auto', background: '#f9fafb', borderLeft: '1px solid #e5e7eb', padding: 10, fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
      <div ref={ref} style={box}>
        <b>{t('study.startTitle')}</b>
        <p style={{ margin: '6px 0' }}>{t('study.start.intro')}</p>
        <label style={label}>{t('study.start.group')}</label>
        <select style={field} value={group} onChange={(e) => setGroup(e.target.value as Group)} data-testid="study-group">
          <option value="">—</option>
          {GROUPS.map((g) => <option key={g}>{g}</option>)}
        </select>
        <label style={label}>{t('study.start.role')}</label>
        <select style={field} value={role} onChange={(e) => setRole(e.target.value as Role)} data-testid="study-role">
          <option value="">—</option>
          <option value="estudiant">{t('study.start.roleStudent')}</option>
          <option value="professorat">{t('study.start.roleTeacher')}</option>
        </select>
        {role === 'estudiant' && (<>
          <label style={label}>{t('study.start.course')}</label>
          <select style={field} value={course} onChange={(e) => setCourse(e.target.value)} data-testid="study-course">
            <option value="">—</option>
            {[1, 2, 3, 4].map((c) => <option key={c} value={c}>{t(`study.start.course${c}`)}</option>)}
          </select>
        </>)}
        <label style={label}>{t('study.start.device')}</label>
        <select style={field} value={device} onChange={(e) => setDevice(e.target.value as Device)} data-testid="study-device">
          <option value="">—</option>
          {DEVICES.map((v) => <option key={v} value={v}>{t(`study.start.devices.${v}`)}</option>)}
        </select>
        <label style={label}>{t('study.start.country')}</label>
        <select style={field} value={country ?? '?'} onChange={(e) => setCountry(e.target.value === '?' ? null : e.target.value)} data-testid="study-country">
          <option value="?">—</option>
          <option value="">{t('study.start.noAnswer')}</option>
          {countries.map((c, i) => (
            <option key={c.code} value={c.code} style={i === FIRST_COUNTRY_COUNT - 1 ? { borderBottom: '1px solid #999' } : undefined}>{c.name}</option>
          ))}
        </select>
        <label style={label}>{t('study.start.hand')}</label>
        <select style={field} value={hand} onChange={(e) => setHand(e.target.value)}>
          <option value="">{t('study.start.noAnswer')}</option>
          <option value="dreta">{t('study.start.handRight')}</option>
          <option value="esquerra">{t('study.start.handLeft')}</option>
          <option value="ambidextra">{t('study.start.handBoth')}</option>
        </select>
        <label style={label}>{t('study.start.experience')}</label>
        <select style={field} value={experience} onChange={(e) => setExperience(e.target.value)} data-testid="study-experience">
          <option value="">—</option>
          <option value="cap">{t('study.start.expNone')}</option>
          <option value="poca">{t('study.start.expLittle')}</option>
          <option value="molta">{t('study.start.expMuch')}</option>
        </select>
        <label style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={share} onChange={(e) => { setShare(e.target.checked); if (!e.target.checked) setPublish(false); }} data-testid="study-share" />
          <span>{t('study.start.share')}</span>
        </label>
        <label style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'flex-start', opacity: share ? 1 : 0.5 }}>
          <input type="checkbox" checked={publish} disabled={!share} onChange={(e) => setPublish(e.target.checked)} data-testid="study-publish" />
          <span>{t('study.start.publish')}</span>
        </label>
        <label style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="study-consent" />
          <span>{t('study.start.consent')}</span>
        </label>
        <p style={{ fontSize: 11, color: '#6b7280', margin: '8px 0' }}>
          {t('study.start.envNote', { environment: env ? describeEnv(env, t) : '…' })}
        </p>
        {hasTeachSamples && (
          <p style={{ fontSize: 12, background: '#fef3c7', padding: 6, borderRadius: 6 }} data-testid="study-teach-warning">
            {t('study.start.teachWarning')}
          </p>
        )}
        <button style={{ ...btn(ready ? '#1d4ed8' : '#9ca3af', '#fff'), width: '100%', marginTop: 4 }} disabled={!ready} data-testid="study-begin"
          onClick={() => ready && onStart(group as Group, {
            role: role as Role,
            course: role === 'estudiant' ? Number(course) : null,
            device: device as Device,
            literacyCountry: country ?? '',
            handedness: (hand || null) as Participant['handedness'],
            experience: experience as Participant['experience'],
          }, share, publish)}>{t('study.start.begin')}</button>
      </div>
    </aside>
  );
}

function SusForm({ condition, onDone }: { condition: Condition; onDone: (answers: number[]) => void }) {
  const { t } = useT();
  const items = susItems(t);
  const [a, setA] = useState<(number | null)[]>(items.map(() => null));
  return (
    <div style={box} data-testid="study-sus">
      <b>{t('study.sus.title')}</b>
      <p style={{ margin: '6px 0' }}><Rich text={t('study.sus.intro', { condition: t(`study.condition.${condition}`) })} /></p>
      {items.map((q, i) => (
        <div key={i} style={{ margin: '8px 0' }}>
          <div>{i + 1}. {q}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
            {[1, 2, 3, 4, 5].map((v) => (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input type="radio" name={`sus-${i}`} checked={a[i] === v} onChange={() => setA((x) => x.map((y, k) => (k === i ? v : y)))} />{v}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button style={{ ...btn('#1d4ed8', '#fff'), width: '100%' }} disabled={a.some((x) => x === null)} data-testid="study-sus-done"
        onClick={() => onDone(a as number[])}>{t('study.sus.continue')}</button>
    </div>
  );
}

function FinalForm({ onDone }: { onDone: (c: StudyComments) => void }) {
  const { t } = useT();
  const [c, setC] = useState<StudyComments>({ freehand: '', ketcher: '', preference: '', other: '' });
  const area = (k: 'freehand' | 'ketcher' | 'other', q: string) => (
    <>
      <label style={label}>{q}</label>
      <textarea style={{ ...field, minHeight: 56 }} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} data-testid={`study-comment-${k}`} />
    </>
  );
  return (
    <div style={box}>
      <b>{t('study.final.title')}</b>
      <p style={{ fontSize: 12, color: '#4b5563' }}>{t('study.final.noPersonal')}</p>
      {area('freehand', t('study.final.freehand'))}
      {area('ketcher', t('study.final.ketcher'))}
      <label style={label}>{t('study.final.preference')}</label>
      <select style={field} value={c.preference} onChange={(e) => setC({ ...c, preference: e.target.value as StudyComments['preference'] })} data-testid="study-preference">
        <option value="">{t('study.final.prefNone')}</option>
        <option value="mechand">{t('study.final.prefMechand')}</option>
        <option value="ketcher">{t('study.final.prefKetcher')}</option>
        <option value="igual">{t('study.final.prefSame')}</option>
      </select>
      {area('other', t('study.final.other'))}
      <button style={{ ...btn('#16a34a', '#fff'), width: '100%', marginTop: 8 }} data-testid="study-final-done" onClick={() => onDone(c)}>{t('study.final.save')}</button>
    </div>
  );
}
