/**
 * Errors the account layer raises. Screens show `message` as written, so the
 * wording here is the wording the user reads.
 */
export class BackendError extends Error {}

/**
 * The server could not be reached at all — as opposed to answering with a
 * refusal. Only this one is worth retrying on the device: a wrong password is
 * still a wrong password offline.
 */
export class OfflineError extends BackendError {}
