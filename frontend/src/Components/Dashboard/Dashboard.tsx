import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import Navbar from '../Navbar';
import UsersCard from './UsersCard';
import RecentHistory from './RecentHistory';
import Footer from '../Footer';
import { useAuth } from '../../context/AuthContext';

// recharts is the heaviest dependency on this page, so the chart loads after
// the shell. The fallback mirrors the card so nothing shifts when it swaps in.
const ProgressionChart = lazy(() => import('./ProgressionChart'));

function ProgressionChartFallback() {
  return (
    <div className="px-4 md:px-20">
      <div className="bg-card border border-line rounded-2xl shadow-sm p-6 transition-theme">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-semibold text-text-main transition-theme">Progression</h2>
          <div className="h-5 w-24 rounded bg-line/40 animate-pulse" />
        </div>
        <div className="h-72 rounded-xl bg-line/30 animate-pulse" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-surface transition-theme flex flex-col">
      <Navbar />
      <main className="flex-1">
        <UsersCard />
        <Suspense fallback={<ProgressionChartFallback />}>
          <ProgressionChart />
        </Suspense>
        <RecentHistory />
      </main>
      <Footer />
    </div>
  );
}
