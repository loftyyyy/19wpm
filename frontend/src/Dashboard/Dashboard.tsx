import Navbar from '../Components/Navbar';
import UserProfile from '../assets/User-Avatar.png';
export default function App() {
  return (
    <>
      <div className="p-3">
        <Navbar />
      </div>
      {/* Dashboard body */}
      <div className="py-4 flex flex-col">
        <div className="flex flex-row">
            <div className="flex flex-col items-center transform translate-x-[155px] w-80 h-100 bg-[#F6EBEA] rounded-[10px]">
              <div className="flex flex-col items-center justify-center w-30 h-30 rounded-[100px] mt-8 bg-gray-200">
                <img src={UserProfile} alt="Profile" className="w-33 rounded-full" />
              </div>
              <div className="flex flex-col items-center justify-center mt-4">
                <h1 className="text-[24px] text-[#1F1A1A] font-semibold" style={{ fontFamily: 'Montserrat'}}>Alex Mercer</h1>
                <div className="mt-2">
                  <p className="text-[16px] text-[#514442] font-normal" style={{ fontFamily: 'Inter'}}>Member since Oct 2023</p>
                </div>
              </div>
            </div>
        </div>
      </div>
    </>
  )
}