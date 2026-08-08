import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PageFallback from './Components/PageFallback';

const LandingPage = lazy(() => import('./LandingPage/Landing-page'));
const TypingTest = lazy(() => import('./Components/TypingTest/TypingTest'));
const TestResults = lazy(() => import('./Components/TypingTest/TestResults'));
const LoginContainer = lazy(() => import('./Components/Auth/LoginContainer'));
const OAuth2Callback = lazy(() => import('./Components/Auth/OAuth2Callback'));
const Dashboard = lazy(() => import('./Components/Dashboard/Dashboard'));
const ContentCreation = lazy(() => import('./Components/Content/ContentCreation'));
const Compete = lazy(() => import('./Pages/Compete'));
const Leaderboard = lazy(() => import('./Pages/Leaderboard'));
const About = lazy(() => import('./Pages/About'));
const Race = lazy(() => import('./Pages/Race'));

export default function App() {
  return (
    <Router>
      <Suspense fallback={<PageFallback />}>
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
      </Suspense>
    </Router>
  );
}
