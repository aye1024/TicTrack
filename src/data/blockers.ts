import type { Blocker } from '../types';

/**
 * The competing-response library.
 *
 * CBIT's active ingredient is Habit Reversal Training, and HRT defines a valid
 * competing response by three criteria, not by "something to do instead":
 *
 *   1. Physically incompatible with the tic — it cannot be performed at the
 *      same time as the tic movement or sound.
 *   2. Held for one full minute, or until the premonitory urge subsides,
 *      whichever is longer.
 *   3. Socially inconspicuous, so it can be used in class or at work.
 *
 * Every entry below satisfies all three, and each carries the awareness cue
 * that HRT trains first — you cannot apply a competing response to a tic you
 * have not noticed starting. The model is only ever allowed to choose ids from
 * this list, never to invent an exercise.
 */
export const BLOCKERS: Blocker[] = [
  {
    id: 'slow-blink',
    name: 'Slow controlled blink',
    instructions:
      'Blink slowly and deliberately, about a second down and a second up, then hold your eyes softly open. Keep the cycle going, gaze resting on one point.',
    rationale:
      'A slow voluntary blink recruits the same orbicularis muscles as the tic, but at a speed that cannot coexist with a hard forceful squeeze.',
    awarenessCue:
      'A dry, tight or gritty feeling across the eyelid, or the sense that a blink is "stuck" and needs to be finished properly.',
    regions: ['eyes'],
    kinds: ['motor'],
    keywords: ['blink', 'flutter', 'eyelid'],
    practiceSeconds: 60,
  },
  {
    id: 'soft-gaze-hold',
    name: 'Soft gaze hold',
    instructions:
      'Rest your eyes on something roughly ten feet away and keep them there, eyelids relaxed and slightly open, without tracking anything moving.',
    rationale:
      'Holding a fixed relaxed gaze keeps the extraocular muscles in one position, which is incompatible with rolling, darting or upward-flicking movements.',
    awarenessCue:
      'A pulling sensation at the corner or top of the eye, or the urge to "reset" your vision by flicking it somewhere else.',
    regions: ['eyes'],
    kinds: ['motor'],
    keywords: ['eye roll', 'rolling eyes', 'dart', 'look', 'gaze', 'flick', 'moving eyes'],
    practiceSeconds: 60,
  },
  {
    id: 'soft-lid-rest',
    name: 'Lids at a comfortable rest',
    instructions:
      'Let your upper lids sit halfway open, not squeezed and not wide, and look at one still point. Hold that exact opening.',
    rationale:
      'A squint, a wide-open stare, and a surprised eye gesture all need the lids at an extreme. A mid-open rest cannot be any of those at the same time.',
    awarenessCue:
      'The lids wanting to clamp, fly open, or pull into a surprised or confused shape.',
    regions: ['eyes'],
    kinds: ['motor'],
    keywords: ['squint', 'open wide', 'eyes wide', 'opening eye', 'widening', 'eye gesture', 'surprised', 'confused eyes'],
    practiceSeconds: 60,
  },
  {
    id: 'hands-in-lap',
    name: 'Hands clasped away from your face',
    instructions:
      'Clasp your hands in your lap and leave them there. Keep your eyes on one still point across the room, not on your hands.',
    rationale:
      'Pressing or poking at an eye needs a free hand. Clasped hands take that away, and a fixed gaze keeps the eyes from turning into the hand.',
    awarenessCue:
      'A hand starting to lift toward your face, or a sharp urge to push on or cover an eye.',
    regions: ['eyes', 'hands'],
    kinds: ['motor'],
    keywords: ['pressing eye', 'against the eye', 'pressing on my eye', 'poking'],
    practiceSeconds: 60,
  },
  {
    id: 'lips-together-breathe',
    name: 'Lips together, breathe through nose',
    instructions:
      'Press your lips lightly together, rest your tongue flat on the floor of your mouth with the teeth apart, and breathe slowly in and out through your nose.',
    rationale:
      'A closed relaxed mouth makes biting, lip movements and grimacing physically impossible, while the parted teeth stop the jaw substituting a clench.',
    awarenessCue:
      'Tension gathering around the lips or cheek, or your tongue starting to seek out the spot you usually bite.',
    regions: ['mouth', 'face'],
    kinds: ['motor'],
    keywords: ['bite', 'cheek', 'lip', 'mouth', 'grimace', 'tongue', 'chew', 'pucker', 'wiggle'],
    practiceSeconds: 60,
  },
  {
    id: 'jaw-rest',
    name: 'Jaw rest position',
    instructions:
      'Part your teeth by a few millimetres so they are not touching, tongue resting behind your top teeth, lips closed. Hold that exact spacing.',
    rationale:
      'Clenching and grinding both require tooth contact. Maintaining a deliberate gap removes the end position the tic is driving towards.',
    awarenessCue:
      'Your back teeth drifting together, or a tightening band of pressure at the hinge of the jaw.',
    regions: ['mouth', 'face'],
    kinds: ['motor'],
    keywords: ['clench', 'grind', 'teeth', 'jaw', 'bite down'],
    practiceSeconds: 60,
  },
  {
    id: 'nose-still',
    name: 'Still-nose breathing',
    instructions:
      'Breathe in through your nose for four counts and out for six, keeping the bridge and sides of your nose completely still throughout.',
    rationale:
      'Steady nasal airflow occupies the nasalis and levator muscles used for scrunching and twitching, and the extended exhale lowers arousal at the same time.',
    awarenessCue:
      'An itch or crawling feeling across the bridge of the nose, or the urge to wrinkle it to "clear" something.',
    regions: ['face'],
    kinds: ['motor'],
    keywords: ['nose', 'scrunch', 'twitch', 'wrinkle', 'nostril'],
    practiceSeconds: 60,
  },
  {
    id: 'smooth-forehead',
    name: 'Forehead smooth and still',
    instructions:
      'Let your eyebrows rest down so the forehead stays smooth, and hold them there. Do not wrinkle the nose or clamp the jaw.',
    rationale:
      'An eyebrow raise lifts the forehead. A gentle downward rest is the opposing action, and it is small enough that other people do not notice it.',
    awarenessCue:
      'A lifting feeling across the brow, or the forehead wanting to crease upward.',
    regions: ['face'],
    kinds: ['motor'],
    keywords: ['eyebrow', 'brow', 'raising eyebrow'],
    practiceSeconds: 60,
  },
  {
    id: 'chin-tuck',
    name: 'Gentle chin tuck',
    instructions:
      'Draw your chin straight back a small amount, as if making a slight double chin, and hold with light steady tension. Keep your shoulders down and your eyes level.',
    rationale:
      'The tuck isometrically engages the deep neck flexors, direct antagonists to the sternocleidomastoid that snaps the head sideways or back.',
    awarenessCue:
      'A build-up of tightness down one side of the neck, or the feeling that your head is "not sitting right" until you jerk it.',
    regions: ['neck', 'head'],
    kinds: ['motor'],
    keywords: ['head jerk', 'neck', 'snap', 'toss', 'nod', 'turn head'],
    practiceSeconds: 60,
  },
  {
    id: 'head-midline',
    name: 'Head held in the middle',
    instructions:
      'Keep your chin level, as if a book were balanced on the crown, and lightly hold the head still in the middle. Do not let it start to turn or travel.',
    rationale:
      'Shaking and banging both need the head to move through space. A steady midline hold removes that travel without adding a second jerk.',
    awarenessCue:
      'A wind-up in the neck just before the head wants to whip, shake, or strike something.',
    regions: ['head', 'neck'],
    kinds: ['motor'],
    keywords: ['shake', 'shaking', 'bang', 'banging', 'head bang'],
    practiceSeconds: 60,
  },
  {
    id: 'shoulder-press-down',
    name: 'Shoulders pressed down',
    instructions:
      'Press both shoulders gently down and slightly back, as if sliding your shoulder blades into your back pockets. Keep breathing normally.',
    rationale:
      'Shrugging elevates the upper trapezius. Actively depressing the same shoulder girdle is the direct opposing action, and it is invisible to anyone watching.',
    awarenessCue:
      'One or both shoulders creeping up towards your ears, or a knot of tension building where the neck meets the shoulder.',
    regions: ['shoulders', 'neck'],
    kinds: ['motor'],
    keywords: ['shrug', 'shoulder', 'lift shoulder', 'roll shoulder'],
    practiceSeconds: 60,
  },
  {
    id: 'arms-at-side',
    name: 'Arms anchored at your sides',
    instructions:
      'Let your arms hang straight down and press your palms lightly against your thighs, elbows straight. Keep a constant, even pressure.',
    rationale:
      'Anchoring removes the slack a flinging or flapping movement needs, and the sustained light pressure gives you a steady sensation to attend to instead of the urge.',
    awarenessCue:
      'A twitch or charge building in the forearm or upper arm, or your elbow wanting to lift away from your body.',
    regions: ['arms', 'shoulders'],
    kinds: ['motor'],
    keywords: ['arm', 'fling', 'flap', 'swing', 'jerk arm', 'elbow'],
    practiceSeconds: 60,
  },
  {
    id: 'fist-open-close',
    name: 'Slow fist open and close',
    instructions:
      'Close your hand into a loose fist over three seconds, then open it fully over three seconds. Keep the cycle slow and even.',
    rationale:
      'A slow deliberate cycle keeps the finger flexors and extensors engaged at a tempo a fast repetitive tic cannot break through.',
    awarenessCue:
      'Your fingers starting to fidget or seek a surface, or a restless charge in the hand.',
    regions: ['hands', 'arms'],
    kinds: ['motor'],
    keywords: ['hand', 'finger', 'snap', 'tap', 'pick', 'clench hand', 'wrist'],
    practiceSeconds: 60,
  },
  {
    id: 'hands-clasped',
    name: 'Hands clasped in lap',
    instructions:
      'Interlace your fingers and rest your clasped hands in your lap, pressing the palms together with light steady pressure.',
    rationale:
      'Clasping occupies both hands at once, which blocks touching, picking and tapping tics. All of those need at least one hand free.',
    awarenessCue:
      'One hand drifting towards your face, hair or a nearby surface before you have decided to move it.',
    regions: ['hands'],
    kinds: ['motor'],
    keywords: ['touch', 'pick', 'rub', 'tap', 'scratch', 'hands', 'hair', 'flap', 'gesture', 'inappropriate', 'copropraxia'],
    practiceSeconds: 60,
  },
  {
    id: 'abdominal-brace',
    name: 'Light abdominal brace',
    instructions:
      'Tighten your stomach muscles to about a quarter of your maximum. Firm enough to feel, light enough that your breathing stays even. Hold it there.',
    rationale:
      'A braced core stabilises the trunk, so a twisting, arching or bending tic has no free segment to move through.',
    awarenessCue:
      'A pulling or winding-up sensation through the middle of your back or stomach.',
    regions: ['torso'],
    kinds: ['motor'],
    keywords: ['torso', 'bend', 'twist', 'abdominal', 'back', 'arch', 'gyrate', 'rotate', 'dystonic', 'posture'],
    practiceSeconds: 60,
  },
  {
    id: 'muscle-release',
    name: 'Let the muscle go soft',
    instructions:
      'Breathe in slowly and let the tense area stay heavy and loose for the whole breath. For the stomach, let the belly rise. For the thighs, hamstrings, or buttocks, let them rest into the chair. For the neck, drop the shoulders and keep the neck long. Keep the breath moving so the muscle cannot lock.',
    rationale:
      'A tensing tic is a squeeze in that muscle. A hard brace would copy it. A soft, heavy muscle that keeps moving with the breath cannot hold the same contraction.',
    awarenessCue:
      'A muscle quietly tightening in your stomach, thigh, hamstring, buttock or neck, even when nothing is moving on the outside.',
    regions: ['torso', 'legs', 'neck'],
    kinds: ['motor'],
    keywords: ['tensing', 'tense', 'contract', 'thigh', 'hamstring', 'buttock', 'stomach', 'neck'],
    practiceSeconds: 60,
  },
  {
    id: 'posture-anchor',
    name: 'Hold the posture you are in',
    instructions:
      'Stay in the posture you already have. If you are sitting, keep both feet flat and your weight down through the chair. If you are standing, keep your weight even on both feet. Do not begin the sit, stand, or step the urge is asking for.',
    rationale:
      'Sitting down, standing up, and running are transitions. Holding the posture you are already in is incompatible with starting that transition, and it does not draw attention.',
    awarenessCue:
      'A gathering urge to stand, sit, or take off, before the body has actually changed posture.',
    regions: ['legs', 'torso'],
    kinds: ['motor'],
    keywords: ['sitting down', 'sit down', 'standing up', 'stand up', 'running'],
    practiceSeconds: 60,
  },
  {
    id: 'own-posture',
    name: 'Your own still posture',
    instructions:
      'Clasp your hands, set your shoulders square, and look at your own page or screen. Hold that shape instead of following someone else\'s movement.',
    rationale:
      'Copying a gesture needs free limbs and attention on the other person. A clasped, square posture occupies the limbs, so the mirrored movement cannot start.',
    awarenessCue:
      'Your body starting to shadow someone else\'s movement before you have decided to move.',
    regions: ['torso', 'arms', 'hands'],
    kinds: ['motor'],
    keywords: ['copying', 'echopraxia', 'copy', 'gesture'],
    practiceSeconds: 60,
  },
  {
    id: 'feet-planted',
    name: 'Feet planted and pressed',
    instructions:
      'Put both feet flat on the floor and press down evenly through the heels, as if trying to push the floor away from you.',
    rationale:
      'Steady downward pressure through the legs is incompatible with kicking, bouncing and stomping, and it stays completely hidden under a desk.',
    awarenessCue:
      'Your heel starting to lift, or a jittery charge building through the thigh or calf.',
    regions: ['legs'],
    kinds: ['motor'],
    keywords: ['leg', 'kick', 'bounce', 'foot', 'stomp', 'knee', 'jiggle'],
    practiceSeconds: 60,
  },
  {
    id: 'toes-pressed',
    name: 'Toes pressed into the floor',
    instructions:
      'With both feet flat, press all ten toes down into the sole of your shoe and hold them there. Do not let the toes curl, tap, or lift.',
    rationale:
      'Toe wiggling needs the toes free to move. A steady downward press occupies the same muscles in the opposite direction and stays hidden in your shoes.',
    awarenessCue:
      'A fidget starting in the toes, or the urge to curl and release them.',
    regions: ['legs'],
    kinds: ['motor'],
    keywords: ['toe', 'wiggle', 'wiggling'],
    practiceSeconds: 60,
  },
  {
    id: 'diaphragm-breathing',
    name: 'Diaphragmatic breathing',
    instructions:
      'Rest one hand on your stomach. Breathe in through your nose for four counts so the hand rises, then out through slightly pursed lips for six counts.',
    rationale:
      'This is the standard competing response for throat clearing, grunting and coughing. Smooth low-pressure airflow across the vocal folds prevents the sharp glottal closure those tics require.',
    awarenessCue:
      'A tickle, thickness or "something stuck" feeling at the back of the throat.',
    regions: ['voice'],
    kinds: ['vocal'],
    keywords: ['cough', 'throat', 'clear throat', 'grunt', 'noise', 'gasp'],
    practiceSeconds: 60,
  },
  {
    id: 'paced-exhale',
    name: 'Long paced exhale',
    instructions:
      'Take a normal breath in, then release it in one continuous even stream for eight slow counts, without letting the airflow break or catch.',
    rationale:
      'A sustained unbroken exhale keeps subglottal pressure low and steady, which prevents the abrupt burst behind sniffing, squeaking and yelping tics.',
    awarenessCue:
      'Pressure building behind the nose or upper throat, or a breath catching before the sound comes out.',
    regions: ['voice'],
    kinds: ['vocal'],
    keywords: ['sniff', 'squeak', 'shriek', 'yelp', 'whistle', 'high pitch', 'puff', 'block', 'speech'],
    practiceSeconds: 60,
  },
  {
    id: 'sip-and-swallow',
    name: 'Sip and swallow',
    instructions:
      'Take a small sip of water and swallow slowly and deliberately, then keep the throat relaxed and breathe through your nose for the next few breaths.',
    rationale:
      'Swallowing resets throat tension and is completely invisible socially. It also breaks the irritation cycle, where clearing inflames the throat and makes the next urge stronger.',
    awarenessCue:
      'Dryness or scratchiness at the back of the throat, especially after talking for a while.',
    regions: ['voice', 'mouth'],
    kinds: ['vocal'],
    keywords: ['throat', 'clear', 'dry throat', 'swallow', 'cough'],
    practiceSeconds: 60,
  },
  {
    id: 'quiet-hum-hold',
    name: 'Quiet hum hold',
    instructions:
      'With lips closed, hum one steady low note just loudly enough to feel the buzz, and hold it for a full comfortable breath. Repeat on the next breath.',
    rationale:
      'A continuous voiced tone holds the vocal folds in a single sustained configuration, which blocks the rapid repeated onsets behind word, syllable and barking tics.',
    awarenessCue:
      'A word or syllable forming before you have chosen it, or tightening at the front of the throat.',
    regions: ['voice'],
    kinds: ['vocal'],
    keywords: ['word', 'syllable', 'repeat', 'phrase', 'say', 'swear', 'echolalia', 'palilalia', 'coprolalia'],
    practiceSeconds: 60,
  },
  {
    id: 'silent-nasal-breath',
    name: 'Silent breath through the nose',
    instructions:
      'Close your lips, keep your teeth slightly apart, and breathe slowly in and out through your nose with no voice at all. Make the exhale longer than the inhale.',
    rationale:
      'Humming, shouting, barking, chirping, and similar sounds need either vibrating vocal folds or a sudden open-mouth burst. A silent nasal breath cannot do either, and it is unnoticeable in a classroom.',
    awarenessCue:
      'Pressure or a wordless noise building behind the lips, or the mouth wanting to fly open for a shout or animal sound.',
    regions: ['voice'],
    kinds: ['vocal'],
    keywords: ['hum', 'shout', 'yell', 'scream', 'bark', 'chirp', 'oink'],
    practiceSeconds: 60,
  },
  {
    id: 'progressive-relaxation',
    name: 'Progressive muscle relaxation',
    instructions:
      'Working from your forehead down to your feet, tense each muscle group for five seconds and then release it completely, noticing the difference as it lets go.',
    rationale:
      'Relaxation training is a CBIT component in its own right, not a competing response. It targets the raised arousal that makes every tic more frequent, so it is the right choice when several tics fire together.',
    awarenessCue:
      'Several tics escalating at once, or a general wound-up feeling with no single clear urge.',
    regions: ['head', 'neck', 'shoulders', 'torso', 'arms', 'legs'],
    kinds: ['motor', 'vocal'],
    keywords: ['stress', 'tension', 'everywhere', 'all over', 'anxious', 'many'],
    practiceSeconds: 180,
  },
];

export const blockerById = (id: string) => BLOCKERS.find((b) => b.id === id);

export const blockersForTic = (region: string, kind: string) =>
  BLOCKERS.filter(
    (b) => b.kinds.includes(kind as never) && b.regions.includes(region as never),
  );

/**
 * HRT holds a competing response for one minute *or until the urge subsides*,
 * whichever is longer — so the timer is a floor, not a target.
 */
export const MIN_HOLD_SECONDS = 60;
