import { useState } from 'react';
import LandingPage from './pages/LandingPage';
import AuthModal from './components/AuthModal';

function App() {
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
