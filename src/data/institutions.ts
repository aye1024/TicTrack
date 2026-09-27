/** Institutions a clinician can join, and a patient can choose from. */
export const INSTITUTIONS = [
  "Children's Healthcare of Atlanta",
  'Emory Healthcare',
  'Grady Health System',
  'Northside Hospital',
  'Piedmont Healthcare',
  'Wellstar Health System',
] as const;

export type Institution = (typeof INSTITUTIONS)[number];

export function isInstitution(value: string): value is Institution {
  return (INSTITUTIONS as readonly string[]).includes(value);
}
