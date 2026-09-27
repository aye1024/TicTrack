import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_URL } from '../config';
import { BackendError, OfflineError } from './errors';
import * as offline from './offline';
import type {
  AccountRole,
  AppData,
  ClinicianOption,
  InboxRow,
  Message,
  PatientRow,
} from '../types';

const SESSION_KEY = 'tictrack:session';
const MODE_KEY = 'tictrack:mode';

export { BackendError, OfflineError };
export type { ClinicianOption, InboxRow, PatientRow };

type AuthResponse = { token: string; data: AppData };

/**
 * Where this account lives. `server` is the Express API in `server/`, which is
 * the only way two devices share a thread or a caseload. `local` is the
 * on-device store in `offline.ts`, used when that server cannot be reached ΓÇö
 * so the app still signs up, checks in and practises on a phone with no
 * backend running at all.
 *
 * The mode is decided once, when the account signs in, and remembered: a
 * session opened against the device store would not be recognised by a server
 * that came back later, and silently switching mid-session would split the
 * account's history across two stores.
 */
type Mode = 'server' | 'local';

let mode: Mode | null = null;

async function currentMode(): Promise<Mode | null> {
  if (mode) return mode;
  const stored = (await AsyncStorage.getItem(MODE_KEY)) as Mode | null;
  mode = stored;
  return mode;
}

async function setMode(next: Mode | null): Promise<void> {
  mode = next;
  if (next) await AsyncStorage.setItem(MODE_KEY, next);
  else await AsyncStorage.removeItem(MODE_KEY);
}

/** True while the account is being kept on this device rather than on the API. */
export async function isOffline(): Promise<boolean> {
  return (await currentMode()) === 'local';
}

function hostFromExpo(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host || null;
}

function apiBase(): string {
  if (API_URL) return API_URL.replace(/\/$/, '');
  const host = hostFromExpo();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:3000`;
  }
  return 'http://localhost:3000';
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // Fall through to the status text.
  }
  return response.statusText || 'Request failed.';
}

async function request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (init.auth !== false) {
    const token = await AsyncStorage.getItem(SESSION_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, { ...init, headers });
  } catch {
    throw new OfflineError('Cannot reach the TicTrack server. Is it running?');
  }

  if (!response.ok) {
    throw new BackendError(await parseError(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Run `viaServer`, and if the server is simply not there, run `onDevice`
 * instead. A refusal from the server ΓÇö a taken username, a wrong password ΓÇö
 * is passed straight through: it would be no less true offline.
 */
async function withFallback<T>(viaServer: () => Promise<T>, onDevice: () => Promise<T>): Promise<T> {
  if (await isOffline()) return onDevice();
  try {
    return await viaServer();
  } catch (error) {
    if (!(error instanceof OfflineError)) throw error;
    return onDevice();
  }
}

async function remember(session: AuthResponse): Promise<AppData> {
  await AsyncStorage.setItem(SESSION_KEY, session.token);
  await setMode('server');
  return session.data;
}

export function accountRole(data: AppData | null | undefined): AccountRole {
  return data?.profile?.role === 'clinician' ? 'clinician' : 'patient';
}

export async function signUp(
  username: string,
  password: string,
  displayName: string,
  role: AccountRole,
  institution?: string,
): Promise<AppData> {
  return withFallback(
    async () => {
      const session = await request<AuthResponse>('/auth/signup', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ username: username.trim(), password, displayName, role, institution }),
      });
      return remember(session);
    },
    async () => {
      const data = await offline.signUp(username, password, displayName, role, institution);
      await setMode('local');
      return data;
    },
  );
}

export async function signIn(
  username: string,
  password: string,
  role: AccountRole,
): Promise<AppData> {
  return withFallback(
    async () => {
      const session = await request<AuthResponse>('/auth/signin', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ username: username.trim(), password, role }),
      });
      return remember(session);
    },
    async () => {
      const data = await offline.signIn(username, password, role);
      await setMode('local');
      return data;
    },
  );
}

export async function restoreSession(): Promise<AppData | null> {
  if (await isOffline()) return offline.restoreSession();

  const token = await AsyncStorage.getItem(SESSION_KEY);
  if (!token) return offline.restoreSession();
  try {
    const session = await request<AuthResponse>('/me');
    return session.data;
  } catch (error) {
    if (error instanceof OfflineError) {
      // The server went away between sessions. Carry on with whatever copy of
      // the account this device has, rather than throwing the user out.
      const local = await offline.restoreSession();
      if (local) {
        await setMode('local');
        return local;
      }
      return null;
    }
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function save(data: AppData): Promise<void> {
  if (!data.profile) return;
  if (await isOffline()) return offline.save(data);
  try {
    await request<AuthResponse>('/me/data', { method: 'PUT', body: JSON.stringify({ data }) });
  } catch (error) {
    if (!(error instanceof OfflineError)) throw error;
    // Lost the server mid-session: keep the account, and everything written
    // since, on the device instead of dropping the write.
    await offline.adopt(data);
    await setMode('local');
  }
}

export async function signOut(): Promise<void> {
  if (!(await isOffline())) {
    try {
      await request('/auth/signout', { method: 'POST' });
    } catch {
      // Clear the local session even if the server is unreachable.
    }
  }
  await offline.signOut();
  await AsyncStorage.removeItem(SESSION_KEY);
  await setMode(null);
}

export async function deleteAccount(_username: string): Promise<void> {
  if (await isOffline()) {
    await offline.deleteAccount();
  } else {
    try {
      await request('/me', { method: 'DELETE' });
    } catch (error) {
      if (!(error instanceof OfflineError)) throw error;
      await offline.deleteAccount();
    }
  }
  await AsyncStorage.removeItem(SESSION_KEY);
  await setMode(null);
}

export async function getPatient(id: string): Promise<AppData | null> {
  try {
    return await withFallback(
      async () => {
        const body = await request<{ data: AppData }>(`/patients/${encodeURIComponent(id)}`);
        return body.data;
      },
      () => offline.getPatient(id),
    );
  } catch {
    return null;
  }
}

export async function listClinicians(institution: string): Promise<ClinicianOption[]> {
  return withFallback(
    async () => {
      const body = await request<{ clinicians: ClinicianOption[] }>(
        `/clinicians?institution=${encodeURIComponent(institution)}`,
        { auth: false },
      );
      return body.clinicians;
    },
    () => offline.listClinicians(institution),
  );
}

export async function listPatients(clinicianId: string): Promise<PatientRow[]> {
  return withFallback(
    async () => {
      const body = await request<{ patients: PatientRow[] }>(
        `/patients?clinicianId=${encodeURIComponent(clinicianId)}`,
      );
      return body.patients;
    },
    () => offline.listPatients(clinicianId),
  );
}

export async function loadMessages(patientId: string, clinicianId: string): Promise<Message[]> {
  return withFallback(
    async () => {
      const body = await request<{ messages: Message[] }>(
        `/threads?patientId=${encodeURIComponent(patientId)}&clinicianId=${encodeURIComponent(clinicianId)}`,
      );
      return body.messages;
    },
    () => offline.loadMessages(patientId, clinicianId),
  );
}

export async function sendMessage(
  patientId: string,
  clinicianId: string,
  fromId: string,
  text: string,
): Promise<Message[]> {
  return withFallback(
    async () => {
      const body = await request<{ messages: Message[] }>('/threads/messages', {
        method: 'POST',
        body: JSON.stringify({ patientId, clinicianId, text }),
      });
      return body.messages;
    },
    () => offline.sendMessage(patientId, clinicianId, fromId, text),
  );
}

export async function listInbox(clinicianId: string): Promise<InboxRow[]> {
  return withFallback(
    async () => {
      const body = await request<{ inbox: InboxRow[] }>('/inbox');
      return body.inbox;
    },
    () => offline.listInbox(clinicianId),
  );
}
