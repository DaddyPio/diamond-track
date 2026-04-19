/** Firestore top-level collection ids — single place to rename or migrate later. */
export const COLLECTION_NAMES = {
  users: 'users',
  teams: 'teams',
  training_logs: 'training_logs',
  instructions: 'instructions',
  instruction_completions: 'instruction_completions',
  notifications: 'notifications',
  performance_records: 'performance_records',
  attendance: 'attendance',
} as const;

export type CollectionName = (typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES];
