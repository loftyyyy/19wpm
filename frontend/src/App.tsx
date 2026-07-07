import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage/Landing-page';
import TypingTest from './Components/TypingTest/TypingTest';
import TestResults from './Components/TypingTest/TestResults';
import LoginContainer from './Components/Auth/LoginContainer';
import OAuth2Callback from './Components/Auth/OAuth2Callback';
import Dashboard from './Components/Dashboard/Dashboard';
import ContentCreation from './Components/Content/ContentCreation';
import Compete from './Pages/Compete';
import Leaderboard from './Pages/Leaderboard';
import About from './Pages/About';
import Race from './Pages/Race';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/solo" element={<TypingTest />} />
        <Route path="/results" element={<TestResults />} />
        <Route path="/login" element={<LoginContainer />} />
        <Route path="/oauth2/callback" element={<OAuth2Callback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<ContentCreation />} />
        <Route path="/compete" element={<Compete />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/about" element={<About />} />
        <Route path="/race" element={<Race />} />
      </Routes>
    </Router>
  );
}
