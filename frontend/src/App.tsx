import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import AuthModal from './components/AuthModal';

function App() {
  const { loading, user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const openLogin = () => {
    setAuthMode('login');
    setAuthOpen(true);
  };

  const openSignup = () => {
    setAuthMode('signup');
    setAuthOpen(true);
  };

  if (loading) {
    return null;
  }

  if (user) {
    return <DashboardPage />;
  }

  return (
    <>
      <LandingPage onLogin={openLogin} onSignup={openSignup} />
      <AuthModal
        open={authOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        onClose={() => setAuthOpen(false)}
      />
    </>
  );
}

export default App;
