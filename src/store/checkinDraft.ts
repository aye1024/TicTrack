import type { CheckIn, ContextFactor } from '../types';

/**
 * The in-flight check-in, shared across the three screens of the flow. Kept
 * outside React state on purpose: the practice screen can be backgrounded and
 * resumed without losing the ratings the user already entered.
 */
export type CheckInDraft = Omit<CheckIn, 'id' | 'date' | 'createdAt'>;

let draft: CheckInDraft | null = null;

export const setDraft = (next: CheckInDraft) => {
  draft = next;
};

export const patchDraft = (changes: Partial<CheckInDraft>) => {
  if (draft) draft = { ...draft, ...changes };
};

export const getDraft = (): CheckInDraft | null => draft;

export const clearDraft = () => {
  draft = null;
};

export type { ContextFactor };
