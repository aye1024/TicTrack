import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as backend from './backend';
import {
  emptyData,
  type AccountRole,
  type AppData,
  type CheckIn,
  type ContextFactor,
  type Tic,
} from '../types';
import { todayKey } from '../logic/analysis';
import { pickTargetTic, shouldRotateTarget } from '../logic/targeting';
import { labelTic, matchBlockersLocally, regionMentioned } from '../llm/fallback';

type Ctx = {
  data: AppData;
  ready: boolean;
  signedIn: boolean;
  signUp: (
    u: string,
    p: string,
    name: string,
    role: AccountRole,
    institution?: string,
  ) => Promise<void>;
  signIn: (u: string, p: string, role: AccountRole) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  update: (recipe: (draft: AppData) => void) => void;
  setTics: (tics: Tic[]) => void;
  recordCheckIn: (checkIn: Omit<CheckIn, 'id' | 'date' | 'createdAt'>) => CheckIn;
  todayCheckIn: CheckIn | null;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveGen = useRef(0);

  useEffect(() => {
    backend
      .restoreSession()
      .then((restored) => {
        if (!restored) {
          setData(emptyData);
          return;
        }
        // Accounts created before the wearable existed have no link stored.
        if (!restored.wearable) restored.wearable = { deviceIds: [], pairedAt: null, lastSyncAt: null };
        let changed = false;
        for (const tic of restored.tics) {
          if (tic.kind !== 'vocal') {
            const mentioned = regionMentioned(`${tic.name} ${tic.description}`);
            if (mentioned && mentioned !== tic.region) {
              tic.region = mentioned;
              const matched = matchBlockersLocally([tic]);
              if (matched.matches[0]?.blockerIds.length) tic.blockerIds = matched.matches[0].blockerIds;
              changed = true;
            }
          }
          if (tic.severity < 1) {
            tic.severity = 1;
            changed = true;
          }
          if (tic.urge < 1) {
            tic.urge = 1;
            changed = true;
          }
          const next = labelTic(`${tic.description} ${tic.name}`, {
            kind: tic.kind,
            region: tic.region,
          }).name;
          if (next && next !== tic.name) {
            tic.name = next;
            changed = true;
          }
        }
        setData(restored);
        if (changed) backend.save(restored).catch(() => {});
      })
      .finally(() => setReady(true));
  }, []);

  /** Debounced write-behind, so rapid slider changes do not thrash storage. */
  const persist = useCallback((next: AppData) => {
    const gen = ++saveGen.current;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (gen !== saveGen.current) return;
      backend.save(next).catch(() => {});
    }, 300);
  }, []);

  const update = useCallback(
    (recipe: (draft: AppData) => void) => {
      setData((current) => {
        const draft: AppData = JSON.parse(JSON.stringify(current));
        recipe(draft);
        persist(draft);
        return draft;
      });
    },
    [persist],
  );

  const signUp = useCallback(
    async (u: string, p: string, name: string, role: AccountRole, institution?: string) => {
      setData(await backend.signUp(u, p, name, role, institution));
    },
    [],
  );

  const signIn = useCallback(async (u: string, p: string, role: AccountRole) => {
    setData(await backend.signIn(u, p, role));
  }, []);

  const signOut = useCallback(async () => {
    await backend.signOut();
    setData(emptyData);
  }, []);

  const deleteAccount = useCallback(async () => {
    const username = data.profile?.username;
    saveGen.current += 1;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (username) await backend.deleteAccount(username);
    else await backend.signOut();
    setData(emptyData);
  }, [data.profile?.username]);

  const setTics = useCallback(
    (tics: Tic[]) => {
      update((draft) => {
        draft.tics = tics;
        const target = pickTargetTic(tics);
        draft.targetTicId = target?.id ?? null;
      });
    },
    [update],
  );

  const todayCheckIn = useMemo(
    () => data.checkIns.find((c) => c.date === todayKey()) ?? null,
    [data.checkIns],
  );

  const recordCheckIn = useCallback(
    (input: Omit<CheckIn, 'id' | 'date' | 'createdAt'>) => {
      const checkIn: CheckIn = {
        ...input,
        id: `c_${Date.now().toString(36)}`,
        date: todayKey(),
        createdAt: new Date().toISOString(),
      };
      update((draft) => {
        const existing = draft.checkIns.findIndex((c) => c.date === checkIn.date);
        if (existing >= 0) draft.checkIns[existing] = checkIn;
        else draft.checkIns.push(checkIn);

        // Today's ratings become the tic's current severity everywhere else.
        for (const entry of checkIn.entries) {
          const tic = draft.tics.find((t) => t.id === entry.ticId);
          if (tic) {
            tic.severity = Math.max(1, entry.severity);
            tic.urge = Math.max(1, entry.urge);
          }
        }

        // A blocker rated ineffective is retired so it is not suggested again.
        if (checkIn.blockerEffective === false && checkIn.targetTicId && checkIn.blockerId) {
          const tic = draft.tics.find((t) => t.id === checkIn.targetTicId);
          if (tic && !tic.retiredBlockerIds.includes(checkIn.blockerId)) {
            tic.retiredBlockerIds.push(checkIn.blockerId);
          }
        }

        draft.targetStreakDays =
          checkIn.targetTicId && checkIn.targetTicId === draft.targetTicId
            ? draft.targetStreakDays + 1
            : 1;

        const rotation = shouldRotateTarget(draft);
        if (rotation.rotate && rotation.toTicId) {
          draft.targetTicId = rotation.toTicId;
          draft.targetStreakDays = 0;
        } else if (!draft.targetTicId) {
          draft.targetTicId = pickTargetTic(draft.tics)?.id ?? null;
        }
      });
      return checkIn;
    },
    [update],
  );

  const value = useMemo<Ctx>(
    () => ({
      data,
      ready,
      signedIn: Boolean(data.profile),
      signUp,
      signIn,
      signOut,
      deleteAccount,
      update,
      setTics,
      recordCheckIn,
      todayCheckIn,
    }),
    [data, ready, signUp, signIn, signOut, deleteAccount, update, setTics, recordCheckIn, todayCheckIn],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export type { ContextFactor };
