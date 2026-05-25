import Navbar from '../Components/Navbar';
import ProgressionChart from '../Components/ProgressionChart';
import UsersCard from '../Components/UsersCard';
import RecentHistory from '../Components/RecentHistory';
export default function App() {
  return (
    <>
      {/* Navbar */}
      <Navbar />

      {/* Dashboard body */}
      <div className="py-4 flex flex-col">
        {/* User Profile content */}
        <UsersCard />

        {/* Progression content */}
        <ProgressionChart />

        {/* Recent History content*/}
        <RecentHistory />
        
      </div>
    </>
  )
}