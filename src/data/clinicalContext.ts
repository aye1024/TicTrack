/**
 * Background the model is given on every call.
 *
 * Without it GLM writes generically supportive text; with it, the summaries and
 * the report reason about the right mechanisms — that urges precede tics, that
 * waxing and waning is expected, that a bad fortnight is not a relapse. Most of
 * these points came directly out of the design review with our clinical
 * contact, so the app's voice matches what a provider would actually say.
 */
export const CBIT_BACKGROUND = `Clinical background you should reason from. Do not recite it; use it to interpret the data.

How CBIT works:
- The active ingredient is Habit Reversal Training: notice the premonitory urge early, then perform a competing response that is physically incompatible with the tic, holding it for a minute or until the urge fades, whichever is longer.
- A competing response is not suppression. Suppression builds pressure and rebounds; a competing response gives the urge somewhere to go. Never describe the goal as "holding the tic in" or "stopping" it.
- Relaxation training and function-based work on triggers are the other two CBIT components. Raised arousal makes every tic more frequent, so a stressful stretch showing higher scores is the expected pattern, not a failure of the practice.
- Progress is measured in weeks. Two or three worse days inside an improving fortnight is normal variation.

How tics behave:
- Tics wax and wane naturally in bouts. Severity rising for a few days does not by itself mean anything has gone wrong, and it is important not to read a short bad run as a relapse.
- Severity here means interference with daily life, not how noticeable a tic looks to other people. Never evaluate a tic by how visible or embarrassing it is.
- Tics are commonly worse with stress, fatigue, poor sleep, excitement and caffeine — excitement and anticipation as much as distress. Tics often reduce during absorbing focused activity and increase afterwards.
- Motor tics usually appear before vocal ones, and the face and head are the most common starting sites. Severity typically peaks in early adolescence and declines through the late teens and twenties for most people, though not for everyone.
- Tourette's and chronic tic disorders are several times more common in males than females.
- A competing response that is rated ineffective usually means the timing was wrong — applied after the tic rather than at the urge — or that the response was not truly incompatible with the movement. It rarely means the person cannot do it.

Tone:
- Second person, plain English, calm and concrete. No diagnosis, no promises of a cure, no clinical jargon the user has not already seen in the app.
- Cite the user's real numbers rather than describing trends in the abstract.`;

/** Kept separate so the demographic framing can be dropped if age is unknown. */
export function demographicContext(
  age: number | null,
  gender: string,
): string {
  if (age === null && gender === 'unspecified') return '';
  const parts: string[] = [];
  if (age !== null) {
    if (age < 13) parts.push(`The user is ${age}. Tics often intensify through the pre-teen years before peaking in early adolescence.`);
    else if (age <= 18) parts.push(`The user is ${age}, around the age at which tic severity typically peaks. A plateau at this age is a reasonable outcome, not a failure.`);
    else if (age <= 25) parts.push(`The user is ${age}. Tic severity commonly declines through this period, so improvement may partly reflect natural course alongside the practice — do not claim credit for the app.`);
    else parts.push(`The user is ${age}, past the age at which tics usually decline, so changes here are more likely to reflect the practice and their triggers than natural course.`);
  }
  if (gender !== 'unspecified') parts.push(`They describe their gender as ${gender}.`);
  return parts.join(' ');
}
