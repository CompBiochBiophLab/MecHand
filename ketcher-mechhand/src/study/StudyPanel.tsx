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
import { btn } from '../ui/Modal';
import { FIRST_COUNTRY_COUNT, countryOptions } from './countries';
import { type StudyEnvironment, describeEnvironment, detectEnvironment } from './environment';
import {
  type Device, type Participant, type Role, StudyRecorder, newParticipantCode, studyState,
} from './recorder';
import { CONDITION_LABEL, type Condition, GROUPS, type Group, stimulus, tasksFor } from './tasks';

const params = new URLSearchParams(location.search);

const DEVICES: [Device, string][] = [
  ['tauleta-llapis', 'Tauleta amb llapis'],
  ['tauleta-dit', 'Tauleta amb el dit'],
  ['ordinador-llapis', 'Ordinador amb llapis o tauleta gràfica'],
  ['ordinador-tactil', 'Ordinador amb pantalla tàctil (dit)'],
  ['ordinador-trackpad', 'Ordinador amb trackpad'],
  ['ordinador-ratoli', 'Ordinador amb ratolí'],
  ['altre', 'Altre'],
];

/** System Usability Scale (Brooke, 1996), Catalan translation. */
export const SUS_ITEMS = [
  "Crec que m'agradaria utilitzar aquesta eina sovint.",
  "He trobat l'eina innecessàriament complexa.",
  "He trobat que l'eina era fàcil d'utilitzar.",
  "Crec que necessitaria l'ajuda d'una persona amb coneixements tècnics per poder utilitzar l'eina.",
  "He trobat que les diverses funcions de l'eina estaven ben integrades.",
  "He trobat que hi havia massa incoherències en l'eina.",
  "M'imagino que la majoria de la gent aprendria a utilitzar l'eina molt ràpidament.",
  "He trobat l'eina molt feixuga d'utilitzar.",
  "M'he sentit molt segur/a utilitzant l'eina.",
  "Hauria d'aprendre moltes coses abans de poder començar a utilitzar l'eina.",
];

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
    const id = setInterval(() => setTick((t) => t + 1), 1000);
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
    return <StartForm env={env} hasTeachSamples={teach.samples.length + teach.elements.length > 0} onClearTeach={onClearTeach}
      onStart={(group, participant, share, publish) => {
        if (!env) return;
        // Samples already in this browser may be someone else's: each session starts from the shared model.
        onClearTeach();
        const r = StudyRecorder.create({
          appVersion, modelVersion, code: newParticipantCode(), group, participant,
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
        <b>Estudi MecHand</b>
        {progress.phase === 'done' ? (
          <span style={{ fontFamily: 'monospace', fontSize: 14 }} title="El teu codi anònim">{session.code}</span>
        ) : (
          <button type="button" onClick={() => setShowCode((v) => !v)} title="El teu codi anònim (es mostra al final)"
            style={{ fontFamily: 'monospace', fontSize: 13, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, cursor: 'pointer', padding: '1px 6px' }}>
            {showCode ? session.code : 'MH-•••••'}
          </button>
        )}
      </div>

      {progress.phase === 'teach' && (
        <div style={box}>
          <b>1. Entrenament (uns 10 minuts)</b>
          <p>Ensenya a MecHand la teva lletra. Obre <b>✍ Teach</b> i desa unes 3 mostres de cada:</p>
          <ul style={{ paddingLeft: 18, margin: '4px 0' }}>
            <li><i>Letters &amp; signs</i>: C, O, N, H, F, l (de Cl), r (de Br), a (de Na), +, −</li>
            <li><i>Arrows</i>: fletxa corba de 2 e⁻, fletxa de reacció, equilibri</li>
            <li><i>Electrons</i>: parell solitari</li>
          </ul>
          <p style={{ color: '#4b5563' }}>Sota el requadre veuràs com ho llegeix MecHand. Si encerta (✓), no cal insistir-hi.</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={btn('#1d4ed8', '#fff')} onClick={() => { rec.log('teach-open'); onOpenTeach(); }}>Obre ✍ Teach</button>
            <button style={btn('#16a34a', '#fff')} data-testid="study-teach-done" onClick={() => {
              rec.log('teach-end', undefined, { letters: teach.samples.length, elements: teach.elements.length });
              go('tasks', 0);
            }}>He acabat l'entrenament</button>
          </div>
        </div>
      )}

      {progress.phase === 'tasks' && task && (() => {
        const s = stimulus(task.stimulus);
        const inBlock = session.tasks.filter((t) => t.block === task.block);
        const k = inBlock.findIndex((t) => t.id === task.id);
        const secs = running ? rec.elapsed(task.id) : 0;
        void tick;
        return (
          <div style={box}>
            <div style={{ fontSize: 12, color: '#4b5563' }}>Bloc {task.block} de 2 · tasca {k + 1} de {inBlock.length}{task.practice ? ' · pràctica (no compta)' : ''}</div>
            <div data-testid="study-condition" style={{
              margin: '6px 0', padding: '4px 8px', borderRadius: 6, fontWeight: 600,
              background: task.condition === 'freehand' ? '#dbeafe' : '#fef3c7', color: task.condition === 'freehand' ? '#1e3a8a' : '#78350f',
            }}>{CONDITION_LABEL[task.condition]}</div>
            <p style={{ margin: '6px 0' }}>{s.task}</p>
            <img src={`${import.meta.env.BASE_URL}study/${s.file}`} alt={s.source.title}
              onClick={() => setZoom(true)} style={{ width: '100%', cursor: 'zoom-in', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff' }} />
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
              {s.source.title.replace(/^File:/, '')} · {s.source.author} · {s.source.license}
              {s.source.license.startsWith('CC') ? ' · convertida a PNG' : ''}
            </div>
            {!running ? (
              <button style={{ ...btn('#1d4ed8', '#fff'), marginTop: 8, width: '100%' }} data-testid="study-start-task" onClick={async () => {
                await clearCanvas();
                rec.startTask(task.id);
                setRunning(true);
              }}>Comença la tasca</button>
            ) : (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                  {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button style={{ ...btn('#16a34a', '#fff'), flex: 1 }} data-testid="study-finish-task" onClick={() => finishTask(false)}>He acabat</button>
                  <button style={btn('#f3f4f6', '#374151')} onClick={() => confirm('Vols ometre aquesta tasca?') && finishTask(true)}>Omet</button>
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
          <b>Moltes gràcies!</b>
          <p>Descarrega el fitxer de la sessió i copia'l tu mateix/a a la memòria USB de l'estudi (la persona responsable no mira el nom del fitxer). No l'enviïs per correu.</p>
          <button style={{ ...btn('#1d4ed8', '#fff'), width: '100%' }} data-testid="study-download" onClick={() => {
            const text = fileText ?? rec.finish(teach);
            setFileText(text);
            download(`mechand-estudi-${session.code}.json`, text);
          }}>Descarrega {`mechand-estudi-${session.code}.json`}</button>
          <p style={{ fontSize: 12, background: '#f3f4f6', padding: 6, borderRadius: 6 }} data-testid="study-choices">
            Les teves opcions: mostres de ✍ Teach al fitxer: <b>{session.shareTeachSamples ? 'sí' : 'no'}</b>;
            publicació de les mostres: <b>{session.publishTeachSamples ? 'sí' : 'no'}</b>. Han de coincidir amb el
            consentiment en paper; si no, digues-ho ara a la persona responsable.
          </p>
          <p style={{ fontSize: 12, color: '#4b5563' }}>
            Una còpia del fitxer queda a la carpeta de baixades d'aquest dispositiu; esborra-la després de lliurar-lo.
          </p>
          <p style={{ fontSize: 12, color: '#4b5563' }}>
            Guarda el teu codi <b>{session.code}</b>: si més endavant vols retirar les teves dades, només cal que l'enviïs
            a l'equip investigador.
          </p>
          <button style={{ ...btn('#fef2f2', '#b91c1c'), width: '100%' }} data-testid="study-clear" onClick={() => {
            if (!confirm("S'esborraran la sessió i les mostres d'entrenament d'aquest navegador. Ja has descarregat el fitxer?")) return;
            StudyRecorder.clearStorage();
            onClearTeach();
            studyState.recorder = null;
            setFileText(null);
            setRec(null);
          }}>Esborra les dades d'aquest navegador</button>
        </div>
      )}

      <details style={{ fontSize: 11, color: '#6b7280' }}>
        <summary>Què es registra</summary>
        <p>Codi anònim, grup, les teves respostes, {describeEnvironment(session.environment)}; tipus de punter usats:
          {' '}{session.environment.pointerTypes.join(', ') || '—'}. Per a cada tasca: temps, traços (punts x, y i moment
          de cada traç), el que MecHand ha reconegut, les teves decisions, l'ús dels controls del llapis (goma, desfer,
          color, gruix, mode d'entrada), els contactes ignorats pel rebuig de palmell i el dibuix final. Res no surt
          d'aquest navegador.</p>
      </details>
    </aside>
  );
}

function StartForm({ env, hasTeachSamples, onClearTeach, onStart }: {
  env: StudyEnvironment | null;
  hasTeachSamples: boolean;
  onClearTeach: () => void;
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
  const countries = useMemo(() => countryOptions(), []);
  const ready = group && role && (role === 'professorat' || course) && device && country !== null && experience && consent && env;
  const ref = useRef<HTMLDivElement>(null);

  return (
    <aside data-testid="mechand-study" style={{ width: 360, flexShrink: 0, overflowY: 'auto', background: '#f9fafb', borderLeft: '1px solid #e5e7eb', padding: 10, fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
      <div ref={ref} style={box}>
        <b>Estudi MecHand (UVic-UCC)</b>
        <p style={{ margin: '6px 0' }}>Abans de començar has d'haver llegit el full d'informació i signat el consentiment informat.
          La participació és voluntària, no té cap efecte en cap avaluació i la pots deixar en qualsevol moment.</p>
        <label style={label}>Grup (te'l dona la persona responsable)</label>
        <select style={field} value={group} onChange={(e) => setGroup(e.target.value as Group)} data-testid="study-group">
          <option value="">—</option>
          {GROUPS.map((g) => <option key={g}>{g}</option>)}
        </select>
        <label style={label}>Participes com a</label>
        <select style={field} value={role} onChange={(e) => setRole(e.target.value as Role)} data-testid="study-role">
          <option value="">—</option>
          <option value="estudiant">Estudiant del grau en Biotecnologia</option>
          <option value="professorat">Professorat de química</option>
        </select>
        {role === 'estudiant' && (<>
          <label style={label}>Curs</label>
          <select style={field} value={course} onChange={(e) => setCourse(e.target.value)} data-testid="study-course">
            <option value="">—</option>
            {['1r', '2n', '3r', '4t'].map((c, i) => <option key={c} value={i + 1}>{c} curs</option>)}
          </select>
        </>)}
        <label style={label}>Amb què dibuixaràs</label>
        <select style={field} value={device} onChange={(e) => setDevice(e.target.value as Device)} data-testid="study-device">
          <option value="">—</option>
          {DEVICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label style={label}>País on vas aprendre a llegir i escriure</label>
        <select style={field} value={country ?? '?'} onChange={(e) => setCountry(e.target.value === '?' ? null : e.target.value)} data-testid="study-country">
          <option value="?">—</option>
          <option value="">Prefereixo no respondre</option>
          {countries.map((c, i) => (
            <option key={c.code} value={c.code} style={i === FIRST_COUNTRY_COUNT - 1 ? { borderBottom: '1px solid #999' } : undefined}>{c.name}</option>
          ))}
        </select>
        <label style={label}>Mà amb què escrius (opcional)</label>
        <select style={field} value={hand} onChange={(e) => setHand(e.target.value)}>
          <option value="">Prefereixo no respondre</option>
          <option value="dreta">Dreta</option>
          <option value="esquerra">Esquerra</option>
          <option value="ambidextra">Totes dues</option>
        </select>
        <label style={label}>Experiència amb programes de dibuix químic (ChemDraw, Ketcher, Marvin…)</label>
        <select style={field} value={experience} onChange={(e) => setExperience(e.target.value)} data-testid="study-experience">
          <option value="">—</option>
          <option value="cap">Cap</option>
          <option value="poca">Poca (alguna vegada)</option>
          <option value="molta">Molta (sovint)</option>
        </select>
        <label style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={share} onChange={(e) => { setShare(e.target.checked); if (!e.target.checked) setPublish(false); }} data-testid="study-share" />
          <span>Accepto que les mostres que dibuixi a ✍ Teach s'incloguin al fitxer de la sessió (opcional).</span>
        </label>
        <label style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'flex-start', opacity: share ? 1 : 0.5 }}>
          <input type="checkbox" checked={publish} disabled={!share} onChange={(e) => setPublish(e.target.checked)} data-testid="study-publish" />
          <span>Accepto que aquestes mostres es publiquin al repositori obert de MecHand, només amb el símbol i les coordenades x, y (opcional; ha de coincidir amb el que he marcat al consentiment).</span>
        </label>
        <label style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="study-consent" />
          <span>He llegit el full d'informació i he signat el consentiment informat.</span>
        </label>
        <p style={{ fontSize: 11, color: '#6b7280', margin: '8px 0' }}>
          Del teu dispositiu només es registra: {env ? describeEnvironment(env) : '…'}; i quins tipus de punter fas servir (llapis, dit, ratolí).
          No es registra el teu nom, ni l'adreça IP, ni cap identificador del dispositiu.
        </p>
        {hasTeachSamples && (
          <p style={{ fontSize: 12, background: '#fef3c7', padding: 6, borderRadius: 6 }} data-testid="study-teach-warning">
            Aquest navegador ja té mostres d'entrenament (potser d'una altra persona): s'esborraran en començar,
            perquè cada sessió parteixi del model compartit.
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
          }, share, publish)}>Comença</button>
      </div>
    </aside>
  );
}

function SusForm({ condition, onDone }: { condition: Condition; onDone: (answers: number[]) => void }) {
  const [a, setA] = useState<(number | null)[]>(SUS_ITEMS.map(() => null));
  return (
    <div style={box} data-testid="study-sus">
      <b>Valoració del bloc</b>
      <p style={{ margin: '6px 0' }}>Pensa en com has treballat en aquest bloc: <i>{CONDITION_LABEL[condition]}</i>.
        1 = totalment en desacord, 5 = totalment d'acord.</p>
      {SUS_ITEMS.map((q, i) => (
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
        onClick={() => onDone(a as number[])}>Continua</button>
    </div>
  );
}

function FinalForm({ onDone }: { onDone: (c: { liked: string; disliked: string; other: string }) => void }) {
  const [c, setC] = useState({ liked: '', disliked: '', other: '' });
  const area = (k: keyof typeof c, q: string) => (
    <>
      <label style={label}>{q}</label>
      <textarea style={{ ...field, minHeight: 60 }} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
    </>
  );
  return (
    <div style={box}>
      <b>Per acabar (opcional)</b>
      <p style={{ fontSize: 12, color: '#4b5563' }}>No hi escriguis cap dada personal (noms, correus…).</p>
      {area('liked', 'Què és el que més t\'ha agradat del dibuix a mà alçada?')}
      {area('disliked', 'Què milloraries? Què no ha reconegut bé?')}
      {area('other', 'Altres comentaris')}
      <button style={{ ...btn('#16a34a', '#fff'), width: '100%', marginTop: 8 }} data-testid="study-final-done" onClick={() => onDone(c)}>Desa la sessió</button>
    </div>
  );
}
