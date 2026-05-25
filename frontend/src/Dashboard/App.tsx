import Navbar from '../Components/Navbar';

export default function App() {
  return (
    <>
      <div className="p-3">
        <Navbar />
      </div>
      {/* Dashboard body */}
      <div className="p-10 bg-[#D4E1CD] ">
          <h1>Dashboard</h1>
          <p>Welcome to your dashboard!</p>
      </div>
    </>
  )
}