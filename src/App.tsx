import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import Auth from './pages/Auth';
import JoinFamily from './pages/JoinFamily';
import Dashboard from './pages/Dashboard';
import { Loader2 } from 'lucide-react';

import Groceries from './pages/Groceries';
import Notes from './pages/Notes';
import Chores from './pages/Chores';
import Profile from './pages/Profile';


function AuthenticatedApp() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-indigo-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (!profile?.family_id) {
    return <JoinFamily />;
  }

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="groceries" element={<Groceries />} />
        <Route path="notes" element={<Notes />} />
        <Route path="chores" element={<Chores />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
