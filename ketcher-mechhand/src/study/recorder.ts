/**
 * Session recorder of the user study.
 *
 * Privacy by design (see estudi/07-proteccio-dades-i-seguretat.md):
 *  - Everything stays in this browser: memory, plus a backup in localStorage so that
 *    a reload does not lose the session. Nothing is ever sent over the network.
 *  - The participant downloads the session file and hands it over in person.
 *  - Only what the analysis needs is kept: an anonymous random code, the group, the
 *    kind of device, and for each task the times, the ink (x, y points of each
 *    stroke and the time at which the stroke starts), what MecHand recognized and
 *    what the participant decided. No name, no e-mail, no IP address, no browser
 *    fingerprint, no pressure or tilt.
 */

import type { SymbolSample } from '../recognition/dollarP';
import type { Group, StudyTask } from './tasks';

export const SESSION_SCHEMA = 'mechand-study-session/1';
const STORAGE_KEY = 'mechand.study.session.v1';

export type Device = 'tauleta-llapis' | 'ordinador-trackpad' | 'ordinador-ratoli' | 'altre';

export interface StudyEvent {
  /** Milliseconds since the session started. */
  t: number;
  type: string;
  task?: string;
  data?: unknown;
}

export interface StudySession {
  schema: typeof SESSION_SCHEMA;
  appVersion: string;
  modelVersion: string;
  participant: string;
  group: Group;
  device: Device;
  /** Date only (YYYY-MM-DD), no time of day. */
  date: string;
  tasks: StudyTask[];
  events: StudyEvent[];
  /** Teach samples are included only if the participant agreed to share them. */
  shareTeachSamples: boolean;
  teachSamples?: SymbolSample[];
}

/** Random, anonymous participant code such as "MH-7K3Q9" (no link to identity). */
export function newParticipantCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return 'MH-' + [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export class StudyRecorder {
  session: StudySession;
  private t0: number;
  private taskStart = new Map<string, number>();

  constructor(init: Omit<StudySession, 'schema' | 'events' | 'date'> & { events?: StudyEvent[]; date?: string }) {
    this.session = {
      schema: SESSION_SCHEMA,
      date: init.date ?? new Date().toISOString().slice(0, 10),
      events: init.events ?? [],
      ...init,
    } as StudySession;
    this.t0 = performance.now() - (this.session.events.at(-1)?.t ?? 0);
    this.save();
  }

  static restore(): StudySession | null {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      const s = raw ? (JSON.parse(raw) as StudySession) : null;
      return s?.schema === SESSION_SCHEMA ? s : null;
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

  startTask(task: string): void {
    this.taskStart.set(task, this.now());
    this.log('task-start', task);
  }

  /** Seconds since the task started (for the panel's clock). */
  elapsed(task: string): number {
    const s = this.taskStart.get(task);
    return s === undefined ? 0 : Math.round((this.now() - s) / 1000);
  }

  finish(teachSamples: SymbolSample[]): string {
    this.log('session-end');
    const out: StudySession = { ...this.session };
    if (this.session.shareTeachSamples) out.teachSamples = teachSamples;
    return JSON.stringify(out, null, 1);
  }

  private save(): void {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.session));
    } catch {
      /* private mode: the session stays in memory only */
    }
  }
}

/** Ink as recorded for the study: x, y rounded to 0.1 px, plus each stroke's start time. */
export function inkForStudy(strokes: { points: { x: number; y: number }[] }[], startTimes: number[]): unknown[] {
  return strokes.map((s, i) => ({
    t: startTimes[i] ?? null,
    points: s.points.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]),
  }));
}
