import { useAuth } from '../../context/AuthContext';
import { useMemo } from 'react';
import type { TestResult } from '../../types';
import { userDisplayName } from '../../types';
import UserProfile from '../../assets/User-Avatar.png';
import FireIcon from '../../assets/FireIcon.svg';
import AverageWPM from '../../assets/AverageIcon.svg';
import BestWPM from '../../assets/BestIcon.svg';
import LastTestWPM from '../../assets/LastTestIcon.svg';
import TextsCompleted from '../../assets/TextIcon.svg';

export default function UsersCard() {
  const { user, getResults } = useAuth();
  const results = useMemo(() => getResults?.() ?? [], [getResults]);

  const stats = useMemo(() => {
    const completed = results.length;
    if (completed === 0) {
      return { avgWpm: 0, bestWpm: 0, lastWpm: 0, lastAccuracy: 0, totalCompleted: 0 };
    }
    const totalWpm = results.reduce((sum: number, r: TestResult) => sum + r.wpm, 0);
    const bestWpm = Math.max(...results.map((r: TestResult) => r.wpm));
    const last = results[0];
    return {
      avgWpm: Math.round(totalWpm / completed),
      bestWpm,
      lastWpm: last.wpm,
      lastAccuracy: last.accuracy,
      totalCompleted: completed,
    };
  }, [results]);

  return (
    <div className="flex flex-col xl:flex-row gap-6 px-4 md:px-20 py-8">
      <div className="flex flex-col items-center bg-card border border-line rounded-2xl shadow-sm p-8 w-full xl:w-72 transition-theme">
        <div className="w-20 h-20 rounded-full bg-muted overflow-hidden">
          <img src={UserProfile} alt="Profile" className="w-full h-full object-cover" />
        </div>
        <h2 className="mt-4 text-xl font-display font-semibold text-text-main transition-theme">
          {user ? userDisplayName(user) : 'Guest'}
        </h2>
        <p className="text-sm text-text-sub font-sans mt-1 transition-theme">
          Member since {user?.joinDate ?? 'today'}
        </p>
        <div className="mt-6 bg-muted px-4 py-2 rounded-2xl flex items-center gap-2 transition-theme">
          <img src={FireIcon} alt="Streak" className="w-4 h-4" />
          <span className="text-xs font-semibold text-text-sub font-sans transition-theme">
            {user?.streak ?? 0} Day Streak
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard icon={AverageWPM} label="Average WPM" value={stats.avgWpm.toString()} sub="All time" color="text-accent" />
        <StatCard icon={BestWPM} label="Best WPM" value={stats.bestWpm.toString()} sub={results[0] ? `${results[0].author}` : 'No tests yet'} color="text-success" />
        <StatCard icon={LastTestWPM} label="Last Test WPM" value={stats.lastWpm.toString()} sub={`${stats.lastAccuracy}% Accuracy`} color="text-text-main" />
        <StatCard icon={TextsCompleted} label="Texts Completed" value={stats.totalCompleted.toLocaleString()} sub="Across all categories" color="text-text-main" />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-card border border-line rounded-2xl shadow-sm p-6 transition-theme">
      <div className="flex items-center gap-2">
        <img src={icon} alt={label} className="w-5 h-5" />
        <p className="text-sm font-sans font-semibold text-text-sub transition-theme">{label}</p>
      </div>
      <p className={`text-4xl font-bold font-display mt-3 ${color} transition-theme`}>{value}</p>
      <p className="text-sm text-text-sub font-sans mt-2 transition-theme">{sub}</p>
    </div>
  );
}
