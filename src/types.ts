export type TicKind = 'motor' | 'vocal';

export type BodyRegion =
  | 'head'
  | 'eyes'
  | 'face'
  | 'mouth'
  | 'neck'
  | 'shoulders'
  | 'arms'
  | 'hands'
  | 'torso'
  | 'legs'
  | 'voice';

/** A competing response the user performs instead of the tic (CBIT). */
export type Blocker = {
  id: string;
  name: string;
  /** What the user actually does. */
  instructions: string;
  /** Why it works — shown on the practice screen. */
  rationale: string;
  /**
   * What the urge feels like just before this tic fires. HRT trains awareness
   * before it trains the competing response, so this is shown first.
   */
  awarenessCue: string;
  regions: BodyRegion[];
  kinds: TicKind[];
  /** Keywords used by the local matcher when the LLM is unavailable. */
  keywords: string[];
  /** Seconds the guided practice runs for. */
  practiceSeconds: number;
};

export type Tic = {
  id: string;
  name: string;
  kind: TicKind;
  region: BodyRegion;
  description: string;
  /** 1–5, how badly it interferes with daily life. */
  severity: number;
  /** 1–5, strength of the premonitory urge. */
  urge: number;
  /** Ordered candidate blockers; index 0 is the one currently in use. */
  blockerIds: string[];
  /** Blockers already tried and rated ineffective — never re-suggested first. */
  retiredBlockerIds: string[];
  createdAt: string;
};

export type CheckInTicEntry = {
  ticId: string;
  severity: number;
  urge: number;
};

export type ContextFactor = 'stress' | 'poorSleep' | 'fatigue' | 'excitement' | 'caffeine' | 'exercise';

export type CheckIn = {
  id: string;
  /** Local calendar day, YYYY-MM-DD. One check-in per day. */
  date: string;
  createdAt: string;
  entries: CheckInTicEntry[];
  factors: ContextFactor[];
  /** The tic that was targeted for practice on this day. */
  targetTicId: string | null;
  blockerId: string | null;
  practiced: boolean;
  practiceSeconds: number;
  /** null when the user skipped practice. */
  blockerEffective: boolean | null;
  note: string;
};

export type Message = {
  id: string;
  /** Account id of the person who sent it. */
  fromId: string;
  text: string;
  createdAt: string;
};

/** A turn in the patient's conversation with the in-app assistant. */
export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
};

export type AccountRole = 'patient' | 'clinician';

/** A clinician the patient can pick during sign-up. */
export type ClinicianOption = {
  id: string;
  displayName: string;
  username: string;
};

/** One line of a clinician's caseload. */
export type PatientRow = {
  id: string;
  displayName: string;
  ticCount: number;
  checkInCount: number;
  lastCheckIn: string | null;
  averageSeverity: number;
};

/** One line of a clinician's message inbox. */
export type InboxRow = {
  patientId: string;
  displayName: string;
  preview: string;
  lastAt: string | null;
};

export type WearableDeviceId = 'watch' | 'ring' | 'glasses' | 'buds';

/** Which wearables the patient paired, and when they last reported in. */
export type WearableLink = {
  /** Paired devices, in the order they were added. Empty means none. */
  deviceIds: WearableDeviceId[];
  /**
   * Written by accounts from when only one device could be paired. Never read
   * this directly — `linkOf` in `src/data/wearable.ts` folds it into
   * `deviceIds`, and every screen goes through that.
   */
  deviceId?: WearableDeviceId | null;
  /** When the first device was paired. */
  pairedAt: string | null;
  lastSyncAt: string | null;
};

export type Profile = {
  username: string;
  displayName: string;
  role: AccountRole;
  /** Document id, so a patient can point at a clinician account. */
  accountId: string;
  /** Clinic or hospital. Chosen from the institution list. */
  institution: string | null;
  /** Patient only: the clinician account they selected. */
  clinicianId: string | null;
  clinicianName: string | null;
  /** Patient continued without linking a healthcare provider. */
  skippedClinician: boolean;
  age: number | null;
  gender: 'male' | 'female' | 'other' | 'unspecified';
  createdAt: string;
};

export type AppData = {
  profile: Profile | null;
  onboarded: boolean;
  tics: Tic[];
  checkIns: CheckIn[];
  targetTicId: string | null;
  /** Days of work logged against the current target — the whiteboard's counter. */
  targetStreakDays: number;
  /** Raw onboarding narration, kept so the report can quote the user. */
  motorNarrative: string;
  vocalNarrative: string;
  /** Cached LLM summary for the Today screen, regenerated after each check-in. */
  insight: { text: string; generatedAt: string; checkInCount: number } | null;
  /** Messages with the in-app assistant, used when the patient has no clinician. */
  assistantMessages: AssistantMessage[];
  /** Paired wearable, if any. The readings themselves are simulated per day. */
  wearable: WearableLink;
};

export const emptyData: AppData = {
  profile: null,
  onboarded: false,
  tics: [],
  checkIns: [],
  targetTicId: null,
  targetStreakDays: 0,
  motorNarrative: '',
  vocalNarrative: '',
  insight: null,
  assistantMessages: [],
  wearable: { deviceIds: [], pairedAt: null, lastSyncAt: null },
};
