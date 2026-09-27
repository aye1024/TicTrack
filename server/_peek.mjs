import dotenv from 'dotenv';
import { connectDb, User, Thread } from './db.js';
dotenv.config();
await connectDb(process.env.MONGODB_URI);
const users = await User.find({}).lean();
console.log('users:', users.length);
for (const u of users) {
  const p = u.data?.profile || {};
  console.log(`  ${String(u.username).padEnd(16)} ${String(p.role).padEnd(10)} id=${u.id} inst=${p.institution ?? '-'} clinician=${p.clinicianId ?? '-'} tics=${u.data?.tics?.length ?? 0} checkIns=${u.data?.checkIns?.length ?? 0}`);
}
const threads = await Thread.find({}).lean();
console.log('threads:', threads.length);
for (const t of threads) console.log(`  ${t.patientId} <-> ${t.clinicianId} msgs=${t.messages?.length ?? 0}`);
process.exit(0);
