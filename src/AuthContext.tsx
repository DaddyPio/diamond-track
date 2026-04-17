import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from './firebase';
import { UserProfile } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
  quotaExceeded: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  quotaExceeded: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    console.log("AuthContext: Initializing onAuthStateChanged");
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("AuthContext: Auth state changed", firebaseUser?.uid);
      setUser(firebaseUser);
      setIsAuthReady(true);
      
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    }, (error) => {
      console.error("AuthContext: onAuthStateChanged error", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    console.log("AuthContext: Fetching profile for", user.uid);
    const userDocRef = doc(db, 'users', user.uid);
    
    // Initial fetch and listener
    const unsubscribe = onSnapshot(userDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        console.log("AuthContext: Profile found");
        setProfile(snapshot.data() as UserProfile);
      } else {
        console.log("AuthContext: Profile not found");
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("AuthContext: Profile listener error", error);
      if (error instanceof Error && (error.message.includes('Quota exceeded') || error.message.includes('quota'))) {
        setQuotaExceeded(true);
      } else {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady, quotaExceeded }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
