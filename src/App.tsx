import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import Auth from './pages/Auth';
import JoinFamily from './pages/JoinFamily';
import Dashboard from './pages/Dashboard';

import Groceries from './pages/Groceries';
import Notes from './pages/Notes';
import Chores from './pages/Chores';
import Games from './pages/Games';
import QuickMath from './pages/games/QuickMath';
import MemoryMatch from './pages/games/MemoryMatch';
import WaterJugs from './pages/games/WaterJugs';
import TowerOfHanoi from './pages/games/TowerOfHanoi';
import SimonSays from './pages/games/SimonSays';
import ColorChaos from './pages/games/ColorChaos';
import WordScramble from './pages/games/WordScramble';
import ReflexChallenge from './pages/games/ReflexChallenge';
import PatternMemory from './pages/games/PatternMemory';
import SchulteTable from './pages/games/SchulteTable';
import NumberMemory from './pages/games/NumberMemory';
import WhackAMole from './pages/games/WhackAMole';
import Profile from './pages/Profile';


export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedAppContent />
    </AuthProvider>
  );
}

function AuthenticatedAppContent() {
  const { profile, loading: authLoading } = useAuth();

  if (authLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>;
  }

  // If user is authenticated but not in a family, only allow JoinFamily page
  if (profile && !profile.family_id) {
    return (
      <Routes>
        <Route path="*" element={<JoinFamily />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={!profile ? <Auth /> : <Navigate to="/" />} />
      <Route path="/" element={profile ? <AppLayout /> : <Navigate to="/auth" />}>
        <Route index element={<Dashboard />} />
        <Route path="groceries" element={<Groceries />} />
        <Route path="notes" element={<Notes />} />
        <Route path="chores" element={<Chores />} />
        <Route path="games" element={<Games />} />
        <Route path="games/quick-math" element={<QuickMath />} />
        <Route path="games/memory-match" element={<MemoryMatch />} />
        <Route path="games/water-jugs" element={<WaterJugs />} />
        <Route path="games/tower-hanoi" element={<TowerOfHanoi />} />
        <Route path="games/simon-says" element={<SimonSays />} />
        <Route path="games/color-chaos" element={<ColorChaos />} />
        <Route path="games/word-scramble" element={<WordScramble />} />
        <Route path="games/reflex-challenge" element={<ReflexChallenge />} />
        <Route path="games/pattern-memory" element={<PatternMemory />} />
        <Route path="games/schulte-table" element={<SchulteTable />} />
        <Route path="games/number-memory" element={<NumberMemory />} />
        <Route path="games/whack-a-mole" element={<WhackAMole />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}
