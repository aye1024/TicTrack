import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import { BackendError } from './errors';
import { isInstitution } from '../data/institutions';
import { todayKey } from '../logic/analysis';
import {
  buildDemoSeed,
  DEMO_ID_PREFIX,
  DEMO_SEED_VERSION,
} from '../data/demoSeed';
import {
  emptyData,
  type AccountRole,
  type AppData,
  type ClinicianOption,
  type InboxRow,
  type Message,
  type PatientRow,
} from '../types';

/**
 * The same account store, kept on the phone.
 *
 * The Express API in `server/` is the real one: two devices see the same
 * thread and the same caseload because Mongo holds a single copy. This module
 * is what runs when that server cannot be reached — sign-up, check-ins,
 * practice and messages all work, written to AsyncStorage on this device. A
 * clinician account created here is visible to a patient account created here,
 * and to nobody else, which is enough to demo both halves on one phone.
 *
 * The rules are copied from `server/index.js` deliberately, down to the
 * wording of each refusal, so the app behaves the same whichever store is
 * answering. It is a demo fallback and not a security boundary: this is
 * ordinary unencrypted app storage, and the hash below only keeps passwords
 * from sitting in it as plain text.
 */

const ACCOUNTS_KEY = 'tictrack:offline:accounts';
const SESSION_KEY = 'tictrack:offline:session';
const THREADS_KEY = 'tictrack:offline:threads';
const SEED_KEY = 'tictrack:offline:seed';

type Account = {
  id: string;
  /** As the user typed it; the map is keyed by the lower-cased form. */
  username: string;
  displayName: string;
  salt: string;
  /**
   * Null on an account mirrored from the server after it went down mid-session
   * — the password never passes through `save`. The next local sign-in claims
   * the password typed then.
   */
  passwordHash: string | null;
  data: AppData;
};

type Accounts = Record<string, Account>;
type Threads = Record<string, Message[]>;

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) =>
  AsyncStorage.setItem(key, JSON.stringify(value));

const readAccountsRaw = () => readJson<Accounts>(ACCOUNTS_KEY, {});
const readThreadsRaw = () => readJson<Threads>(THREADS_KEY, {});

const readAccounts = async () => {
  await ensureDemoSeed();
  return readAccountsRaw();
};
const writeAccounts = (accounts: Accounts) => writeJson(ACCOUNTS_KEY, accounts);
const readThreads = async () => {
  await ensureDemoSeed();
  return readThreadsRaw();
};

const threadKey = (patientId: string, clinicianId: string) => `${patientId}|${clinicianId}`;

const newId = () =>
  `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const randomSalt = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const hash = (password: string, salt: string) =>
  CryptoJS.SHA256(`${salt}:${password}`).toString();

/** The server forgives a capitalised first letter; so does this. */
function passwordMatches(account: Account, password: string): boolean {
  if (!account.passwordHash || !password) return false;
  const variants = [
    password,
    password[0].toLowerCase() + password.slice(1),
    password[0].toUpperCase() + password.slice(1),
  ];
  return variants.some((candidate) => hash(candidate, account.salt) === account.passwordHash);
}

/**
 * Demo accounts live in `src/data/demoSeed.ts`, not in the database, so the app
 * has a lived-in account to open on a laptop with no server running. They are
 * written into this store on first use.
 *
 * The seed is regenerated when its version changes, and when its newest
 * check-in falls behind yesterday — the history is built relative to today, so
 * a stale copy would show a broken streak and a chart that stops short. If the
 * demo accounts have been deleted, they stay deleted: that was deliberate.
 */
let seeding: Promise<void> | null = null;

function ensureDemoSeed(): Promise<void> {
  if (!seeding) {
    seeding = seedDemoAccounts().catch(() => {
      // A failed seed means the demo accounts are missing, which is visible on
      // the sign-in screen. Allow a later call to try again.
      seeding = null;
    });
  }
  return seeding;
}

const isDemo = (id: string) => id.startsWith(DEMO_ID_PREFIX);

/** True when a demo account's newest check-in is older than yesterday. */
function historyIsStale(accounts: Account[]): boolean {
  const yesterday = todayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  return accounts.some((account) => {
    const checkIns = account.data.checkIns ?? [];
    if (checkIns.length === 0) return false;
    const latest = checkIns.reduce((max, c) => (c.date > max ? c.date : max), '');
    return latest < yesterday;
  });
}

async function seedDemoAccounts(): Promise<void> {
  const marker = await AsyncStorage.getItem(SEED_KEY);
  const accounts = await readAccountsRaw();
  const existing = Object.values(accounts).filter((a) => isDemo(a.id));

  if (marker === DEMO_SEED_VERSION) {
    if (existing.length === 0) return; // deleted on purpose
    if (!historyIsStale(existing)) return;
  }

  const seed = buildDemoSeed();

  // Replace only the demo accounts. A real account created on this device,
  // including one adopted from the server, is left exactly as it was.
  for (const key of Object.keys(accounts)) {
    if (isDemo(accounts[key].id)) delete accounts[key];
  }
  for (const account of seed.accounts) {
    const salt = randomSalt();
    accounts[account.username.toLowerCase()] = {
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      salt,
      passwordHash: hash(account.password, salt),
      data: account.data,
    };
  }
  await writeAccounts(accounts);

  const threads = await readThreadsRaw();
  for (const key of Object.keys(threads)) {
    const [patientId, clinicianId] = key.split('|');
    if (isDemo(patientId) || isDemo(clinicianId)) delete threads[key];
  }
  for (const t of seed.threads) {
    threads[threadKey(t.patientId, t.clinicianId)] = t.messages;
  }
  await writeJson(THREADS_KEY, threads);

  await AsyncStorage.setItem(SEED_KEY, DEMO_SEED_VERSION);
}

const role = (account: Account): AccountRole =>
  account.data.profile?.role === 'clinician' ? 'clinician' : 'patient';

async function currentAccount(): Promise<Account | null> {
  const username = await AsyncStorage.getItem(SESSION_KEY);
  if (!username) return null;
  const accounts = await readAccounts();
  return accounts[username] ?? null;
}

export async function signUp(
  username: string,
  password: string,
  displayName: string,
  accountRole: AccountRole,
  institution?: string,
): Promise<AppData> {
  const name = username.trim();
  const secret = password.trim();
  const shown = displayName.trim() || name;
  const where = (institution ?? '').trim();

  if (name.length < 3) throw new BackendError('Pick a username of at least 3 characters.');
  if (secret.length < 4) throw new BackendError('Pick a password of at least 4 characters.');
  if (accountRole === 'clinician' && !isInstitution(where)) {
    throw new BackendError('Choose your institution.');
  }

  const accounts = await readAccounts();
  const key = name.toLowerCase();
  if (accounts[key]) throw new BackendError('That username is already taken.');

  const id = newId();
  const salt = randomSalt();
  const data: AppData = {
    ...structuredClone(emptyData),
    onboarded: accountRole === 'clinician',
    profile: {
      username: name,
      displayName: shown,
      role: accountRole,
      accountId: id,
      institution: accountRole === 'clinician' ? where : null,
      clinicianId: null,
      clinicianName: null,
      skippedClinician: false,
      age: null,
      gender: 'unspecified',
      createdAt: new Date().toISOString(),
    },
  };

  accounts[key] = { id, username: name, displayName: shown, salt, passwordHash: hash(secret, salt), data };
  await writeAccounts(accounts);
  await AsyncStorage.setItem(SESSION_KEY, key);
  return data;
}

export async function signIn(
  username: string,
  password: string,
  accountRole: AccountRole,
): Promise<AppData> {
  const key = username.trim().toLowerCase();
  const secret = password.trim();
  const accounts = await readAccounts();
  const account = accounts[key];
  if (!account) throw new BackendError('No account with that username.');

  if (account.passwordHash === null) {
    // Mirrored from the server without a password. The first sign-in here sets one.
    account.salt = randomSalt();
    account.passwordHash = hash(secret, account.salt);
  } else if (!passwordMatches(account, secret)) {
    throw new BackendError('That password does not match.');
  }

  const actual = role(account);
  if (actual !== accountRole) {
    throw new BackendError(
      actual === 'clinician'
        ? 'This is a clinician account. Use the clinician log in.'
        : 'This is a patient account. Use the patient log in.',
    );
  }

  accounts[key] = account;
  await writeAccounts(accounts);
  await AsyncStorage.setItem(SESSION_KEY, key);
  return account.data;
}

export async function restoreSession(): Promise<AppData | null> {
  const account = await currentAccount();
  return account ? account.data : null;
}

export async function save(data: AppData): Promise<void> {
  const username = await AsyncStorage.getItem(SESSION_KEY);
  if (!username) return;
  const accounts = await readAccounts();
  const account = accounts[username];
  if (!account) return;
  account.data = data;
  account.displayName = data.profile?.displayName || account.displayName;
  await writeAccounts(accounts);
}

/**
 * Copy an account that was signed in against the server onto this device, so a
 * server that disappears mid-session does not take the session with it.
 */
export async function adopt(data: AppData): Promise<void> {
  const profile = data.profile;
  if (!profile) return;
  const key = profile.username.trim().toLowerCase();
  const accounts = await readAccounts();
  const existing = accounts[key];
  accounts[key] = {
    id: profile.accountId || existing?.id || newId(),
    username: profile.username,
    displayName: profile.displayName,
    salt: existing?.salt ?? randomSalt(),
    passwordHash: existing?.passwordHash ?? null,
    data,
  };
  await writeAccounts(accounts);
  await AsyncStorage.setItem(SESSION_KEY, key);
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function deleteAccount(): Promise<void> {
  const username = await AsyncStorage.getItem(SESSION_KEY);
  if (!username) return;
  const accounts = await readAccounts();
  const account = accounts[username];
  delete accounts[username];
  await writeAccounts(accounts);

  if (account) {
    const threads = await readThreads();
    for (const key of Object.keys(threads)) {
      const [patientId, clinicianId] = key.split('|');
      if (patientId === account.id || clinicianId === account.id) delete threads[key];
    }
    await writeJson(THREADS_KEY, threads);
  }
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function listClinicians(institution: string): Promise<ClinicianOption[]> {
  const accounts = await readAccounts();
  return Object.values(accounts)
    .filter((a) => role(a) === 'clinician' && a.data.profile?.institution === institution)
    .map((a) => ({ id: a.id, displayName: a.displayName, username: a.data.profile?.username ?? a.username }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function caseload(clinicianId: string): Promise<Account[]> {
  const accounts = await readAccounts();
  return Object.values(accounts).filter(
    (a) => role(a) === 'patient' && a.data.profile?.clinicianId === clinicianId,
  );
}

function patientRow(account: Account): PatientRow {
  const checkIns = account.data.checkIns ?? [];
  const last = checkIns[checkIns.length - 1] ?? null;
  const all = checkIns.flatMap((c) => (c.entries ?? []).map((e) => e.severity));
  return {
    id: account.id,
    displayName: account.displayName,
    ticCount: account.data.tics?.length ?? 0,
    checkInCount: checkIns.length,
    lastCheckIn: last?.date ?? null,
    averageSeverity: all.length ? all.reduce((sum, v) => sum + v, 0) / all.length : 0,
  };
}

export async function listPatients(clinicianId: string): Promise<PatientRow[]> {
  return (await caseload(clinicianId)).map(patientRow);
}

export async function getPatient(id: string): Promise<AppData | null> {
  const accounts = await readAccounts();
  return Object.values(accounts).find((a) => a.id === id)?.data ?? null;
}

export async function loadMessages(patientId: string, clinicianId: string): Promise<Message[]> {
  const threads = await readThreads();
  return threads[threadKey(patientId, clinicianId)] ?? [];
}

export async function sendMessage(
  patientId: string,
  clinicianId: string,
  fromId: string,
  text: string,
): Promise<Message[]> {
  const threads = await readThreads();
  const key = threadKey(patientId, clinicianId);
  const messages = threads[key] ?? [];
  const body = text.trim();
  if (!body) return messages;

  messages.push({
    id: `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    fromId,
    text: body,
    createdAt: new Date().toISOString(),
  });
  threads[key] = messages;
  await writeJson(THREADS_KEY, threads);
  return messages;
}

export async function listInbox(clinicianId: string): Promise<InboxRow[]> {
  const patients = await caseload(clinicianId);
  const threads = await readThreads();
  return patients
    .map((account) => {
      const messages = threads[threadKey(account.id, clinicianId)] ?? [];
      const last = messages[messages.length - 1] ?? null;
      return {
        patientId: account.id,
        displayName: account.displayName,
        preview: last?.text ?? 'No messages yet',
        lastAt: last?.createdAt ?? null,
      };
    })
    .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
}
