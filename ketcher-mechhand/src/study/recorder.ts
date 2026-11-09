/**
 * Session recorder of the user study.
 *
 * Privacy by design (see estudi/07-proteccio-dades-i-seguretat.md):
 *  - Everything stays in this browser: memory, plus a backup in localStorage so that
 *    a reload does not lose the session. Nothing is ever sent over the network.
 *  - The participant downloads the session file and hands it over in person.
 *  - Only what the analysis needs is kept: an anonymous random code, the group, a
 *    few answers (role, course, device, country where the participant learned to
 *    read and write, handedness, experience), a coarse description of the browser
 *    and device (environment.ts), and for each task the times, the ink (x, y points
 *    of each stroke and when it was drawn), what MecHand recognized, what the
 *    participant decided and the final drawing. No name, no e-mail, no IP address,
 *    no raw user-agent string, no pressure or tilt.
 */

import type { ElementSample } from '../recognition/elements';
import type { SymbolSample } from '../recognition/dollarP';
import type { SketchResult } from '../recognition/sketch';
import type { StudyEnvironment } from './environment';
import type { Condition, Group, StudyTask } from './tasks';

export const SESSION_SCHEMA = 'mechand-study-session/2';
const STORAGE_KEY = 'mechand.study.session.v2';

export type Device =
  | 'tauleta-llapis' | 'tauleta-dit' | 'ordinador-llapis' | 'ordinador-tactil'
  | 'ordinador-ratoli' | 'ordinador-trackpad' | 'altre';
export type Role = 'estudiant' | 'professorat';

export interface Participant {
  role: Role;
  /** Students: year of the degree (1–4); teachers: null. */
  course: number | null;
  device: Device;
  /** ISO 3166-1 alpha-2 code of the country where the participant learned to read and write ("" = not answered). */
  literacyCountry: string;
  handedness: 'dreta' | 'esquerra' | 'ambidextra' | null;
  /** Previous use of chemical drawing software. */
  experience: 'cap' | 'poca' | 'molta';
}

export interface StudyEvent {
  /** Milliseconds since the session started. */
  t: number;
  type: string;
  task?: string;
  data?: unknown;
}

export type Phase = 'teach' | 'tasks' | 'sus' | 'final' | 'done';

export interface StudySession {
  schema: typeof SESSION_SCHEMA;
  appVersion: string;
  modelVersion: string;
  /** Random code such as "MH-7K3Q9", with no link to the participant's identity. */
  code: string;
  group: Group;
  /** Date only (YYYY-MM-DD), no time of day. */
  date: string;
  participant: Participant;
  environment: StudyEnvironment;
  tasks: StudyTask[];
  /** Where the participant is (to resume after a reload). */
  progress: { phase: Phase; task: number };
  events: StudyEvent[];
  /** System Usability Scale answers (1–5) per condition, in item order. */
  sus: Partial<Record<Condition, number[]>>;
  /** Open answers of the final questionnaire. */
  comments: { liked: string; disliked: string; other: string };
  /** Teach samples are included only if the participant agreed to share them. */
  shareTeachSamples: boolean;
  /** …and may be published (without any other data) only if the participant also agreed to that. */
  publishTeachSamples: boolean;
  teachSamples?: { samples: SymbolSample[]; elements: ElementSample[] };
}

/** Random, anonymous participant code such as "MH-7K3Q9" (no link to identity). */
export function newParticipantCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return 'MH-' + [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

/** What MecHand read, as kept in the session (no image, no raw strokes beyond the ink). */
export function resultForStudy(r: SketchResult) {
  return {
    scene: r.scene,
    roles: r.roles,
    labels: r.labels.map((l) => l.text),
    arrows: r.arrows.map((a) => ({ kind: a.arrow.kind, from: a.from, to: a.to })),
    confidence: Math.round(r.confidence * 1000) / 1000,
  };
}

/** Ink as recorded for the study: x, y rounded to 0.1 px, and when each stroke started and ended (ms of the session). */
export function inkForStudy(
  strokes: { points: { x: number; y: number }[] }[],
  times: { start: number; end: number }[],
  sessionStart: number,
): { t0: number | null; t1: number | null; points: number[][] }[] {
  return strokes.map((s, i) => ({
    t0: times[i] ? Math.round(times[i].start - sessionStart) : null,
    t1: times[i] ? Math.round(times[i].end - sessionStart) : null,
    points: s.points.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]),
  }));
}

export class StudyRecorder {
  session: StudySession;
  /** performance.now() at the session start (shifted on restore so that times continue). */
  readonly t0: number;
  private taskStart = new Map<string, number>();

  constructor(session: StudySession) {
    this.session = session;
    this.t0 = performance.now() - (session.events.at(-1)?.t ?? 0);
    this.save();
  }

  static create(init: Omit<StudySession, 'schema' | 'events' | 'date' | 'progress' | 'sus' | 'comments'>): StudyRecorder {
    return new StudyRecorder({
      schema: SESSION_SCHEMA,
      date: new Date().toISOString().slice(0, 10),
      events: [],
      progress: { phase: 'teach', task: 0 },
      sus: {},
      comments: { liked: '', disliked: '', other: '' },
      ...init,
    });
  }

  static restore(): StudyRecorder | null {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      const s = raw ? (JSON.parse(raw) as StudySession) : null;
      return s?.schema === SESSION_SCHEMA ? new StudyRecorder(s) : null;
    } catch {
      return null;
    }
  }

  static clearStorage(): void {
    try {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  now(): number {
    return Math.round(performance.now() - this.t0);
  }

  log(type: string, task?: string, data?: unknown): void {
    this.session.events.push({ t: this.now(), type, task, data });
    this.save();
  }

  notePointer(type: string): void {
    const seen = this.session.environment.pointerTypes;
    if (type && !seen.includes(type)) {
      seen.push(type);
      this.save();
    }
  }

  setProgress(progress: StudySession['progress']): void {
    this.session.progress = progress;
    this.save();
  }

  startTask(task: string): void {
    this.taskStart.set(task, this.now());
    this.log('task-start', task);
  }

  /** Seconds since the task started (for the panel's clock). */
  elapsed(task: string): number {
    const s = this.taskStart.get(task);
    return s === undefined ? 0 : Math.round((this.now() - s) / 1000);
  }

  /** The session file. Teach samples are added only with the participant's consent. */
  finish(teach: { samples: SymbolSample[]; elements: ElementSample[] }): string {
    this.log('session-end');
    const out: StudySession = { ...this.session };
    if (this.session.shareTeachSamples) out.teachSamples = teach;
    return JSON.stringify(out, null, 1);
  }

  save(): void {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.session));
    } catch {
      /* private mode: the session stays in memory only */
    }
  }
}

/**
 * The recorder of the running session, if any (study mode only). The app logs
 * recognition and the participant's decisions through it.
 */
export const studyState: { recorder: StudyRecorder | null; task: StudyTask | null } = { recorder: null, task: null };

export function studyLog(type: string, data?: unknown): void {
  const { recorder, task } = studyState;
  if (recorder && task) recorder.log(type, task.id, data);
}
