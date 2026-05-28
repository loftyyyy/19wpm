import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage/Landing-page';
import TypingTest from './Components/TypingTest/TypingTest';
import TestResults from './Components/TypingTest/TestResults';
import LoginContainer from './Components/Auth/LoginContainer';
import Dashboard from './Components/Dashboard/Dashboard';
import ContentCreation from './Components/Content/ContentCreation';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/solo" element={<TypingTest />} />
        <Route path="/results" element={<TestResults />} />
        <Route path="/login" element={<LoginContainer />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<ContentCreation />} />
      </Routes>
    </Router>
  );
}
