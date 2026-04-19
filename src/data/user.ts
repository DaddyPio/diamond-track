import { doc, onSnapshot, type DocumentSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTION_NAMES } from './collectionNames';

export function subscribeToUserDocument(
  uid: string,
  onNext: (snapshot: DocumentSnapshot) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(db, COLLECTION_NAMES.users, uid);
  return onSnapshot(ref, onNext, onError);
}
