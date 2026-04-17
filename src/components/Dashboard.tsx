import React from 'react';
import { useAuth } from '../AuthContext';
import CoachDashboard from './CoachDashboard';
import PlayerDashboard from './PlayerDashboard';

export default function Dashboard({ setActiveTab }: { setActiveTab: (tab: string, date?: string) => void }) {
  const { profile } = useAuth();

  if (profile?.role === 'coach') {
    return <CoachDashboard setActiveTab={setActiveTab} />;
  }

  return <PlayerDashboard setActiveTab={(tab) => setActiveTab(tab)} />;
}
