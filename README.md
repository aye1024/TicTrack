# TicTrack

TicTrack is a CBIT (Comprehensive Behavioral Intervention for Tics) companion. A patient describes their tics, the app turns that into a short list and matches each one to a competing response, and a daily check-in takes about a minute. Over a couple of weeks it can say which tic is changing and what the worse days have in common. A clinician can see the patients who chose them and read the same thread.

Patients and clinicians are separate accounts. A patient can link a clinician at one of the listed health systems, or continue with no provider and use the in-app assistant instead.

## What a patient does

1. Create an account, or log in as a patient.
2. Choose a health system, then a clinician who has already registered there. Or skip and use the app without a provider.
3. Onboarding is five steps. The first screen explains CBIT: notice the urge, do a competing movement, and do not suppress the tic. Then describe motor tics, then vocal tics (either can be skipped), rate each one from 1 to 5, and confirm the competing responses. Severity means interference, not how noticeable the tic looks to someone else. A tracked tic never sits at 0, so it stays on the body diagram.
4. Land on five tabs: **Today**, **Tics**, **Messages**, **History**, and **Profile**.

Today is the check-in and the current target tic. Tics is the list, including adding one later. Messages is a thread with the linked clinician, or a chat with the assistant when no clinician is linked. History charts severity. **Get full report** writes a new report each time that page opens. Profile shows the linked clinician and can change or drop that link, holds sample history for a demo, and can reset or delete the account.

The home screen, the progress report, and the note after practice are written by the model when a GLM key is present. The same screens use local rules when the key is missing or the request fails.

## What a clinician does

A clinician signs up with a display name, a username, and one institution from a fixed list (Children's Healthcare of Atlanta, Emory Healthcare, Grady Health System, Northside Hospital, Piedmont Healthcare, Wellstar Health System). They then log in on the clinician page, not the patient page.

The clinician view has two tabs:

- **Caseload** lists only patients who selected that clinician.
- **Messages** is the inbox for those patients. Opening a conversation leaves the tabs and shows that thread.

A patient report is available from the caseload. Logging out is on the caseload screen.

## Check-in and practice

Each day the patient rates the tics, notes context (stress, poor sleep, fatigue, excitement, caffeine, exercise), and can practice the competing response for the current target.

The practice session follows how noticeable the urge was on that check-in, for the target tic:

- **Urge 1–3.** The feeling is easy to miss. The first minute is only for noticing it. The second minute holds the competing response.
- **Urge 4–5.** The feeling is already obvious. The session is the competing response only.

The hold is a floor of one minute, or until the urge eases, whichever is longer. When the minute ends, the screen asks whether the urge has settled. Holding longer is offered when it has not.

A competing response has to be physically incompatible with that tic, holdable for a full minute, and inconspicuous enough for class or work. The model may only choose ids from `src/data/blockers.ts`. Anything else is discarded. Relaxation training is its own entry, for when several tics fire together and there is no single movement to oppose.

The target tic is the one with the highest severity. Urge breaks ties, and a tic that still has an unused competing response is preferred. The target changes when another tic has scored higher on six of the last seven days.

## Wearable (prototype)

A check-in is one number given from memory at night. The wearable screen covers
the hours in between: pair an Apple Watch, a smart ring, glasses or AirPods —
any number of them at once — and the app shows how many tics were counted today,
which hours they clustered in, how long each one ran, and the 0–5 rating those
counts work out to. That rating can be carried straight into the check-in, one
tap per tic.

What is paired changes what is visible. A watch or a ring reads movement; a
microphone is what hears a vocal tic; only the wrist and the finger report sleep
and a stress index. When nothing paired can see one of the listed tics, the
screen says so instead of leaving a gap.

**What lines up** is the reason to wear anything at all. `factorCorrelation` in
`src/logic/analysis.ts` compares what the patient *reports* — "I slept badly" —
against the severity they rated themselves, which is one number recalled at
bedtime by someone who had a bad day. `wearableCorrelations` does the other half:
the sleep hours and stress index the hardware produced, against the tic count the
hardware produced, with the patient's judgement out of the loop on both sides. A
link is only shown when at least two days fall each side of the line and the
count moved by 12% or more. Where the measured and the reported agree, the
pattern is worth acting on.

Both sides are simulated here, and from the same daily ratings, so a link found
in demo data is not independent evidence of anything. The calculation is what is
real, and a HealthKit feed would drop into it unchanged.

With several devices paired, each tic is credited to the closest sensor and
counted once, not once per device — the earbuds get the throat clearing, the
glasses get the blink, the watch gets the shoulder. Closeness means something
different per kind, which is why `deviceFor` in `src/data/wearable.ts` picks the
listen-only device for a vocal tic and the one naming the body region for a
motor one.

No sensor is involved. The readings are generated from the user's own ratings
with a fixed seed, so a given day always reads back the same, and the screen
says plainly that it is a prototype. `src/data/wearable.ts` holds the model;
swapping it for a real HealthKit or BLE feed would not change the screens.

## Messages

A patient who picked a clinician shares one thread with that clinician. Both sides read and write the same conversation, stored apart from either user's profile. A patient who skipped a provider gets the assistant in the Messages tab. That assistant is not a clinician: it will not diagnose or prescribe, and if the model is unavailable it shows a standing note instead of a generated reply.

## Running it

The app is Expo SDK 57. Expo Go already includes the native modules it uses, including the microphone stream, so a phone does not need Xcode or Android Studio.

```bash
npm install
npx expo start
```

`npx expo start --web` runs the browser build. Dictation works there too, batched: the browser has no microphone stream to open a socket for, so the recording is uploaded after the fact instead of transcribed live. Typing still works, and so do summaries and the report.

### API and database

Accounts, check-ins, and messages are stored in MongoDB. The Express server in `server/` is the only thing that talks to the database. The phone keeps a session token and sends it with each request.

```bash
cp server/.env.example server/.env
```

Put the Atlas connection string in `server/.env`, then:

```bash
npm install --prefix server
npm run server
```

The API listens on port 3000. On the same computer, the web app uses `http://localhost:3000`. On a phone opened through Expo's LAN address, the app calls port 3000 on that same computer, which has to be running the server. The Expo tunnel only delivers the JavaScript bundle. It does not forward the API.

To point every build at one hosted server, set `EXPO_PUBLIC_API_URL` to that server's URL before starting Expo.

### Running with no server at all

If no server answers, the app does not stop. Sign-up falls back to `src/store/offline.ts`, an
AsyncStorage copy of the same account store, and everything the patient does — onboarding,
check-ins, practice, history, the report, the wearable — works on that phone. A clinician account
created on the same device sees the patient accounts created there, so both halves can be
demonstrated on one phone.

The rules are copied from `server/index.js` down to the wording of each refusal, so the app behaves
the same whichever store answers. What is lost is the only thing a device cannot do: two phones
sharing one caseload or one thread. Profile shows **Account server: OFF** whenever the fallback is
in use — the app never pretends the data left the device.

The choice is made once, when the account signs in, and remembered, because a session opened against
the device store means nothing to a server that comes back later. Sign out to pick again. A refusal
from the server — a taken username, a wrong password — is passed straight through rather than
retried locally.

### Model and speech keys

Speech and the model read their keys from `.env`, which is gitignored. Copy the template and fill in the keys you have:

```bash
cp .env.example .env
```

Restart Expo after changing it. `EXPO_PUBLIC_*` values are injected at bundle time, so a reload will not pick them up. Do not put keys in `app.json`.

The template lists the GLM key, the API URL, and one block per speech provider.
See the table under [Speech recognition](#speech-recognition) for what each
provider costs and which paths it can serve.

With every speech key unset, the microphone button is hidden. With the GLM key unset, onboarding, blocker matching, the home summary, practice feedback, the report, and the assistant all use the local rules in `src/llm/fallback.ts`.

## How it is put together

| Concern | Where | Notes |
|---|---|---|
| Speech to text | `src/asr/` | ElevenLabs Scribe, streaming on device and batched on web |
| Language model | `src/llm/` | GLM-5.2, streaming, with a local fallback |
| CBIT content | `src/data/` | Competing responses, institutions, clinical grounding |
| Domain rules | `src/logic/` | Target selection, rotation, correlations |
| API client | `src/store/backend.ts` | Session token plus calls to the Express server |
| On-device store | `src/store/offline.ts` | The same account rules, used when no server answers |
| API server | `server/` | Express, Mongoose, bcrypt password hashes |
| Screens | `app/` | expo-router. Patient tabs, clinician panel, onboarding, check-in |

### The model

GLM-5.2 is called through Zhipu's chat completions endpoint, using `expo/fetch`. React Native's global `fetch` is XHR-backed and exposes no readable body, so it cannot stream.

Reasoning mode is off on every call, and the model has to be one that allows that. On the progress report, reasoning ran anywhere from 8k to 22k characters on the same prompt, often used the whole token budget, and returned nothing, at 45 to 70 seconds. With reasoning off, the same report finishes in a few seconds.

That rules out Zhipu's newest flash models: `glm-5.3-flash` and `glm-5.3-flashx` reject `thinking: disabled` outright and always reason. Measured on the report prompt at the 1600-token budget `glm.ts` sends:

| Model | Time | Reasoning | Completion tokens used |
|---|---|---|---|
| `glm-5.2` | 3.5s | none | 161 |
| `glm-4.5-flash` | 6.9s | none | 170 |
| `glm-5-turbo` | 8.0s | none | 162 |
| `glm-5.3-flashx` | 10.2s | 3.2k chars | 1204 |
| `glm-5.3-flash` | 34.9s | 4.0k chars | 1495 |

`glm-5.3-flash` left 105 of 1600 tokens for the answer itself, which is the failure above waiting to happen on a longer history. `glm-5.2` is both the newest usable model and the fastest, so it is the default. `src/data/clinicalContext.ts` supplies how habit reversal works, how tics wax and wane, and what an ineffective rating usually means.

The prompt includes per-tic direction, which responses were tried and rejected, practice ratings, weekday, age and gender when the patient gave them, and the patient's own description from sign-up.

### Speech recognition

Four providers are wired up, and the app uses whichever has a key, in the order
below. They are not the same shape, so `src/asr/` runs two paths behind one
`useDictation` hook:

| Provider | Streaming | Batch | Cost |
|---|---|---|---|
| **ElevenLabs Scribe** (default) | `scribe_v2_realtime` | `scribe_v2` | paid |
| Deepgram Nova-3 | `nova-3` | — | $200 credit, no card |
| iFlytek RTASR | RTASR | — | paid time packs |
| Groq Whisper | — | `whisper-large-v3-turbo` | 2,000 requests a day, permanent |

On the **streaming** path, `expo-audio` hands back raw 16-bit PCM as it is captured and it goes straight into a WebSocket. Nothing is saved as an audio file. On the **batch** path the microphone records to a file, which is uploaded once and then discarded — about a second of waiting, and no live text.

Streaming is preferred when it is available, because revising the text mid-sentence is the better experience. `provider.ts` holds that decision. ElevenLabs is first because it is the only one that can do both, so the phone and the browser behave the same; the browser cannot stream at all, since `useAudioStream` is a stub there.

Details in `src/asr/` worth knowing:

- Android often captures at 48 kHz even when 16 kHz was requested. `resample.ts` converts the buffers to the 16 kHz mono every streaming provider expects. A wrong rate returns an empty transcript rather than an error.
- Scribe's realtime socket wants each frame as base64 inside a JSON `input_audio_chunk`, not as a binary frame. React Native has neither `Buffer` nor `btoa`, so `crypto-js` — already a dependency for iFlytek's signature — does the encoding; its output matches `Buffer.toString('base64')` byte for byte.
- **`keyterms` is a repeated query parameter**, one `keyterms=` per term. Passing the list comma-joined, or as a JSON array, makes the server drop the handshake and send nothing back: no `session_started`, no error, no transcript. Both were tried against the live endpoint before settling on the repeated form.
- Scribe authenticates with an `xi-api-key` header. React Native's WebSocket takes a third options argument and can set headers; a browser cannot, which is the other reason streaming is native-only. Web client-side auth would need a single-use token minted by our own server.
- Ending a stream means sending a chunk with `commit: true` — an empty one is accepted — and the committed text comes back in about 200 ms. The server otherwise holds the socket open another ~17 s, so `finish()` closes it from this side instead of waiting.
- Deepgram cannot carry an `Authorization` header over a WebSocket either; its key goes in the second subprotocol slot, `Sec-WebSocket-Protocol: token, <key>`.
- iFlytek's signature is `base64(HMAC-SHA1(MD5(appid + ts), apiKey))`, and the HMAC is taken over the MD5 hex string, not the raw digest.
- Android often captures at 48 kHz even when 16 kHz was requested — see `resample.ts` above.
- The batch providers pick their demuxer from the filename extension, so the upload is named from the recording's actual type. Chrome and Firefox record WebM, Safari records MP4, and the phone records AAC in MPEG-4. `upload.ts` holds that, shared between ElevenLabs and Groq.

Every provider but iFlytek is set to English. iFlytek's default engine handles English and Chinese, including code-switching, so no language is set there.

## Demo accounts

Eight accounts ship with the app, in `src/data/demoSeed.ts`. They are written
into the on-device store on first launch, so they work with no server and no
database running — nothing to set up before a demo.

| Log in as | Username | Password | What you see |
|---|---|---|---|
| **Noah**, ten weeks in | `noahdemo` | `1234` | 4 tics, ~55 check-ins, a 25-day streak, an improving chart, correlated stress days, all four wearables paired, and a thread with Dr. Ye |
| **Dr. Ye** | `yedemo` | `1234` | A caseload of three patients and an inbox with all three threads |
| Maya, three weeks in | `mayademo` | `1234` | 2 tics, a shorter history |
| Eli, seven weeks in | `elidemo` | `1234` | 3 tics, a target already rotated once |

Four more clinicians — `ramandemo`, `halldemo`, `duartedemo`, `okafordemo` — exist
so that choosing a provider during sign-up is a real list across four
institutions rather than a single name. Every password is `1234`.

Usernames and display names are deliberately different: you log in as
`noahdemo`, and the app calls you Noah.

Noah and Dr. Ye are two sides of the same data. Sign in as Noah, send a message,
sign out, sign in as Dr. Ye, and it is there in the inbox — the caseload numbers,
the patient report and the thread all read the same records.

The history is generated relative to today and rebuilt whenever its newest
check-in falls behind yesterday, so the streak and the chart are never stale.
That means the demo accounts reset themselves after a day away; they are
fixtures, not somewhere to keep real data. Deleting one keeps it deleted.

`npm run verify:demo` checks the seed against the same functions the screens use
— that the streak reaches today, that the trend reads as improving, that the
stored target is the one `pickTargetTic` would choose and is not about to be
rotated away, and that each tic's severity matches the last point on its own
chart.

## Demo tools

On Profile, **Load 14 days of sample history** fills a fortnight so the charts and the report have something to show. The targeted tic improves, the others drift, and stress and poor-sleep days score higher. **Reset account** clears tics, history, and onboarding and keeps the login. **Delete account** removes the login from this server as well, or from this device when the fallback is in use.
