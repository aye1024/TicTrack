import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true },
    passwordHash: { type: String, required: true },
    sessionToken: { type: String, default: null, index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false, id: false },
);

const threadSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, index: true },
    clinicianId: { type: String, required: true, index: true },
    messages: {
      type: [
        {
          id: String,
          fromId: String,
          text: String,
          createdAt: String,
          _id: false,
        },
      ],
      default: [],
    },
  },
  { versionKey: false },
);

threadSchema.index({ patientId: 1, clinicianId: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
export const Thread = mongoose.model('Thread', threadSchema);

export async function connectDb(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: 'tictrack' });
  await copyFromDefaultDatabase();
}

async function copyFromDefaultDatabase() {
  const source = mongoose.connection.useDb('test', { useCache: true });
  const SourceUser = source.models.User || source.model('User', userSchema);
  const SourceThread = source.models.Thread || source.model('Thread', threadSchema);
  const knownUsers = new Set((await User.find({}, { username: 1 }).lean()).map((row) => row.username));
  const oldUsers = await SourceUser.find().lean();
  const usersToCopy = oldUsers.filter((row) => !knownUsers.has(row.username)).map(({ _id, ...rest }) => rest);
  if (usersToCopy.length) await User.insertMany(usersToCopy);

  const knownThreads = new Set(
    (await Thread.find({}, { patientId: 1, clinicianId: 1 }).lean()).map(
      (row) => `${row.patientId}:${row.clinicianId}`,
    ),
  );
  const oldThreads = await SourceThread.find().lean();
  const threadsToCopy = oldThreads
    .filter((row) => !knownThreads.has(`${row.patientId}:${row.clinicianId}`))
    .map(({ _id, ...rest }) => rest);
  if (threadsToCopy.length) await Thread.insertMany(threadsToCopy);
}
