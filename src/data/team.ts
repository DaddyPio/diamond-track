import { doc, onSnapshot, type DocumentSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTION_NAMES } from './collectionNames';

export function subscribeToTeamDocument(
  teamId: string,
  onNext: (snapshot: DocumentSnapshot) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(db, COLLECTION_NAMES.teams, teamId);
  return onSnapshot(ref, onNext, onError);
}
