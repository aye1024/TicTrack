import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { connectDb, Thread, User } from './db.js';

dotenv.config();

const INSTITUTIONS = [
  "Children's Healthcare of Atlanta",
  'Emory Healthcare',
  'Grady Health System',
  'Northside Hospital',
  'Piedmont Healthcare',
  'Wellstar Health System',
];

const BCRYPT_ROUNDS = 10;
const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI ?? '';

const emptyData = {
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
};

function isInstitution(value) {
  return INSTITUTIONS.includes(value);
}

function accountRole(data) {
  return data?.profile?.role === 'clinician' ? 'clinician' : 'patient';
}

function sanitizeData(data) {
  if (!data || typeof data !== 'object') return emptyData;
  const next = structuredClone(data);
  if (next.profile && typeof next.profile === 'object') {
    delete next.profile.password;
  }
  return next;
}

function publicUser(doc) {
  const data = sanitizeData(doc.data);
  if (data.profile) {
    data.profile.accountId = data.profile.accountId || doc.id;
    if (data.profile.clinicianId === undefined) {
      data.profile.clinicianId = null;
      data.profile.clinicianName = null;
    }
    if (data.profile.skippedClinician === undefined) {
      data.profile.skippedClinician = false;
    }
  }
  if (!Array.isArray(data.assistantMessages)) data.assistantMessages = [];
  return { token: doc.sessionToken, data };
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function newId() {
  return `u_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

async function passwordsMatchIgnoringFirstLetter(password, passwordHash) {
  if (!password) return false;
  const lowerFirst = password[0].toLowerCase() + password.slice(1);
  const upperFirst = password[0].toUpperCase() + password.slice(1);
  for (const candidate of [lowerFirst, upperFirst]) {
    if (candidate !== password && (await bcrypt.compare(candidate, passwordHash))) return true;
  }
  return false;
}

async function requireUser(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return sendError(res, 401, 'Sign in again.');
  const user = await User.findOne({ sessionToken: token });
  if (!user) return sendError(res, 401, 'Sign in again.');
  req.user = user;
  next();
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/auth/signup', async (req, res) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '').trim();
    const displayName = String(req.body?.displayName ?? '').trim() || username;
    const role = req.body?.role === 'clinician' ? 'clinician' : 'patient';
    const institution = String(req.body?.institution ?? '').trim();

    if (username.length < 3) return sendError(res, 400, 'Pick a username of at least 3 characters.');
    if (password.length < 4) return sendError(res, 400, 'Pick a password of at least 4 characters.');
    if (role === 'clinician' && !isInstitution(institution)) {
      return sendError(res, 400, 'Choose your institution.');
    }
    if (await User.findOne({ username: username.toLowerCase() })) {
      return sendError(res, 409, 'That username is already taken.');
    }

    const id = newId();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const data = {
      ...structuredClone(emptyData),
      onboarded: role === 'clinician',
      profile: {
        username,
        displayName,
        role,
        accountId: id,
        institution: role === 'clinician' ? institution : null,
        clinicianId: null,
        clinicianName: null,
        skippedClinician: false,
        age: null,
        gender: 'unspecified',
        createdAt: new Date().toISOString(),
      },
    };

    const user = await User.create({
      id,
      username: username.toLowerCase(),
      displayName,
      passwordHash,
      sessionToken: newToken(),
      data,
      updatedAt: new Date(),
    });
    res.status(201).json(publicUser(user));
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Could not create the account.');
  }
});

app.post('/auth/signin', async (req, res) => {
  try {
    const username = String(req.body?.username ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '').trim();
    const role = req.body?.role === 'clinician' ? 'clinician' : 'patient';

    const user = await User.findOne({ username });
    if (!user) return sendError(res, 401, 'No account with that username.');

    const matches =
      (await bcrypt.compare(password, user.passwordHash)) ||
      (await passwordsMatchIgnoringFirstLetter(password, user.passwordHash));
    if (!matches) return sendError(res, 401, 'That password does not match.');

    const actual = accountRole(user.data);
    if (actual !== role) {
      return sendError(
        res,
        403,
        actual === 'clinician'
          ? 'This is a clinician account. Use the clinician log in.'
          : 'This is a patient account. Use the patient log in.',
      );
    }

    user.sessionToken = newToken();
    if (user.data?.profile) {
      user.data.profile.accountId = user.data.profile.accountId || user.id;
      if (user.data.profile.clinicianId === undefined) {
        user.data.profile.clinicianId = null;
        user.data.profile.clinicianName = null;
      }
      if (user.data.profile.skippedClinician === undefined) {
        user.data.profile.skippedClinician = false;
      }
      delete user.data.profile.password;
      if (!Array.isArray(user.data.assistantMessages)) user.data.assistantMessages = [];
      user.markModified('data');
    }
    await user.save();
    res.json(publicUser(user));
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Could not sign in.');
  }
});

app.post('/auth/signout', requireUser, async (req, res) => {
  req.user.sessionToken = null;
  await req.user.save();
  res.json({ ok: true });
});

app.get('/me', requireUser, async (req, res) => {
  res.json(publicUser(req.user));
});

app.put('/me/data', requireUser, async (req, res) => {
  const data = sanitizeData(req.body?.data);
  if (data.profile) {
    data.profile.username = req.user.data?.profile?.username ?? req.user.username;
    data.profile.accountId = req.user.id;
    data.profile.role = accountRole(req.user.data);
  }
  req.user.data = data;
  req.user.displayName = data.profile?.displayName || req.user.displayName;
  req.user.updatedAt = new Date();
  req.user.markModified('data');
  await req.user.save();
  res.json(publicUser(req.user));
});

app.delete('/me', requireUser, async (req, res) => {
  await Thread.deleteMany({
    $or: [{ patientId: req.user.id }, { clinicianId: req.user.id }],
  });
  await req.user.deleteOne();
  res.json({ ok: true });
});

app.get('/clinicians', async (req, res) => {
  const institution = String(req.query.institution ?? '');
  const docs = await User.find({ 'data.profile.role': 'clinician', 'data.profile.institution': institution });
  const clinicians = docs
    .map((doc) => ({
      id: doc.id,
      displayName: doc.displayName,
      username: doc.data?.profile?.username ?? doc.username,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  res.json({ clinicians });
});

app.get('/patients', requireUser, async (req, res) => {
  if (accountRole(req.user.data) !== 'clinician') {
    return sendError(res, 403, 'Only clinicians can view a caseload.');
  }
  const clinicianId = String(req.query.clinicianId ?? req.user.id);
  if (clinicianId !== req.user.id) {
    return sendError(res, 403, 'You can only view your own caseload.');
  }

  const docs = await caseload(clinicianId);
  res.json({ patients: docs.map(patientRow) });
});

function patientRow(doc) {
  const checkIns = doc.data?.checkIns ?? [];
  const last = checkIns[checkIns.length - 1] ?? null;
  const all = checkIns.flatMap((c) => (c.entries ?? []).map((e) => e.severity));
  return {
    id: doc.id,
    displayName: doc.displayName,
    ticCount: doc.data?.tics?.length ?? 0,
    checkInCount: checkIns.length,
    lastCheckIn: last?.date ?? null,
    averageSeverity: all.length ? all.reduce((s, v) => s + v, 0) / all.length : 0,
  };
}

async function caseload(clinicianId) {
  return User.find({
    'data.profile.role': { $ne: 'clinician' },
    'data.profile.clinicianId': clinicianId,
  });
}

async function assertThreadAccess(user, patientId, clinicianId) {
  const role = accountRole(user.data);
  if (role === 'patient') {
    if (user.id !== patientId || user.data?.profile?.clinicianId !== clinicianId) {
      return 'You cannot open this conversation.';
    }
    return null;
  }
  if (user.id !== clinicianId) return 'You cannot open this conversation.';
  const patient = await User.findOne({ id: patientId });
  if (!patient || patient.data?.profile?.clinicianId !== clinicianId) {
    return 'You cannot open this conversation.';
  }
  return null;
}

app.get('/threads', requireUser, async (req, res) => {
  const patientId = String(req.query.patientId ?? '');
  const clinicianId = String(req.query.clinicianId ?? '');
  const blocked = await assertThreadAccess(req.user, patientId, clinicianId);
  if (blocked) return sendError(res, 403, blocked);
  const thread = await Thread.findOne({ patientId, clinicianId });
  res.json({ messages: thread?.messages ?? [] });
});

app.post('/threads/messages', requireUser, async (req, res) => {
  const patientId = String(req.body?.patientId ?? '');
  const clinicianId = String(req.body?.clinicianId ?? '');
  const text = String(req.body?.text ?? '').trim();
  const blocked = await assertThreadAccess(req.user, patientId, clinicianId);
  if (blocked) return sendError(res, 403, blocked);
  if (!text) {
    const existing = await Thread.findOne({ patientId, clinicianId });
    return res.json({ messages: existing?.messages ?? [] });
  }

  const message = {
    id: `m_${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`,
    fromId: req.user.id,
    text,
    createdAt: new Date().toISOString(),
  };
  const thread = await Thread.findOneAndUpdate(
    { patientId, clinicianId },
    { $push: { messages: message } },
    { new: true, upsert: true },
  );
  res.json({ messages: thread.messages });
});

app.get('/inbox', requireUser, async (req, res) => {
  if (accountRole(req.user.data) !== 'clinician') {
    return sendError(res, 403, 'Only clinicians can view the inbox.');
  }
  const patients = await caseload(req.user.id);
  const rows = await Promise.all(
    patients.map(async (doc) => {
      const thread = await Thread.findOne({ patientId: doc.id, clinicianId: req.user.id });
      const last = thread?.messages?.[thread.messages.length - 1] ?? null;
      return {
        patientId: doc.id,
        displayName: doc.displayName,
        preview: last?.text ?? 'No messages yet',
        lastAt: last?.createdAt ?? null,
      };
    }),
  );
  rows.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
  res.json({ inbox: rows });
});

app.get('/patients/:id', requireUser, async (req, res) => {
  const doc = await User.findOne({ id: req.params.id });
  if (!doc) return sendError(res, 404, 'Patient not found.');
  if (accountRole(doc.data) === 'clinician') return sendError(res, 404, 'Patient not found.');

  const self = req.user.id === doc.id;
  const assigned = accountRole(req.user.data) === 'clinician' && doc.data?.profile?.clinicianId === req.user.id;
  if (!self && !assigned) return sendError(res, 403, 'You cannot view this patient.');
  res.json({ data: sanitizeData(doc.data) });
});

async function start() {
  if (!MONGODB_URI || MONGODB_URI.includes('REPLACE_')) {
    console.error('Set MONGODB_URI in server/.env to your Atlas connection string, then restart.');
  }
  try {
    await connectDb(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection failed. Check server/.env.');
    console.error(error.message);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TicTrack API listening on http://0.0.0.0:${PORT}`);
  });
}

start();
