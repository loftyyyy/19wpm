import { useNavigate } from 'react-router-dom';
import Navbar from '../Navbar';
import UsersCard from './UsersCard';
import ProgressionChart from './ProgressionChart';
import RecentHistory from './RecentHistory';
import Footer from '../Footer';
import { useAuth } from '../../context/AuthContext';

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-surface transition-theme flex flex-col">
      <Navbar />
      <main className="flex-1">
        <UsersCard />
        <ProgressionChart />
        <RecentHistory />
      </main>
      <Footer />
    </div>
  );
}
