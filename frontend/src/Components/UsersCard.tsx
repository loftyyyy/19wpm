import UserProfile from '../assets/User-Avatar.png';
import FireIcon from '../assets/FireIcon.svg';
import AverageWPM from '../assets/AverageIcon.svg';
import BestWPM from '../assets/BestIcon.svg';
import LastTestWPM from '../assets/LastTestIcon.svg';
import TextsCompleted from '../assets/TextIcon.svg';
export default function UsersCard() {
    return (
       <>
        {/* User Profile Card */}
        <div className="flex flex-row gap-10">
            <div className="flex flex-col items-center ml-[155px] w-80 h-105 bg-[#F6EBEA] rounded-[10px] shadow-md">
              <div className="flex flex-col items-center justify-center w-30 h-30 rounded-[100px] mt-10 bg-gray-200">
                <img src={UserProfile} alt="Profile" className="w-33 rounded-full" />
              </div>
              <div className="flex flex-col items-center justify-center mt-4">
                <h1 className="text-[24px] text-[#1F1A1A] font-semibold" style={{ fontFamily: 'Montserrat'}}>Alex Mercer</h1>
                <div className="mt-2">
                  <p className="text-[16px] text-[#514442] font-normal" style={{ fontFamily: 'Inter'}}>Member since Oct 2023</p>
                </div>
                <div className="mt-7 bg-[#D4E1CD] w-35 h-9 rounded-2xl flex items-center justify-center">
                  <div className="flex flex-row items-center justify-center w-full gap-2">
                    <img src={FireIcon} alt="Fire-Icon" />
                    <p className="text-[#586454] text-[12px] font-semibold" style={{ fontFamily: 'Inter' }}>14 Day Streak</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-row gap-10">
                {/* Average WPM Card */}
                <div className="flex flex-col p-6 bg-[#F6EBEA] w-85 h-50 rounded-[10px] shadow-md">
                  <div className="flex flex-row text-center items-center gap-2">
                    <img src={AverageWPM} alt="Average WPM" className="w-6 h-6"></img>
                    <p className="text-[16px] text-[#514442] font-semibold" style={{ fontFamily: 'Inter' }}>Average WPM</p>
                  </div>
                  <div className="flex text-center items-center gap-2 mt-4">
                    <h1 className="text-[48px] font-bold text-[#82524D]" style={{ fontFamily: 'Montserrat' }}>84.5</h1>
                  </div>
                  <div className="flex text-center items-center gap-2 mt-4">
                    <h1 className="text-[16px] text-[#514442]" style={{ fontFamily: 'Inter' }}>Last 30 days</h1>
                  </div>
                </div>
                {/* Best WPM Card */}
                <div className="flex flex-col p-6 bg-[#F6EBEA] w-85 h-50 rounded-[10px] shadow-md">
                  <div className="flex flex-row text-center items-center gap-2">
                    <img src={BestWPM} alt="Best WPM" className="w-6 h-6"></img>
                    <p className="text-[16px] text-[#514442] font-semibold" style={{ fontFamily: 'Inter' }}>Best WPM</p>
                  </div>
                  <div className="flex text-center items-center gap-2 mt-4">
                    <h1 className="text-[48px] font-bold text-[#3D6658]" style={{ fontFamily: 'Montserrat' }}>112.0</h1>
                  </div>
                  <div className="flex text-center items-center gap-2 mt-4">
                    <h1 className="text-[16px] text-[#514442]" style={{ fontFamily: 'Inter' }}>Quote: The Great Gatsby</h1>
                  </div>
                </div>
              </div>
              <div className="flex flex-row gap-10">
                {/* Last Test WPM Card*/}
                <div className="flex flex-col p-6 bg-[#F6EBEA] w-85 h-50 rounded-[10px] shadow-md">
                  <div className="flex flex-row text-center items-center gap-2">
                    <img src={LastTestWPM} alt="Last Test WPM" className="w-6 h-6"></img>
                    <p className="text-[16px] text-[#514442] font-semibold" style={{ fontFamily: 'Inter' }}>Last Test WPM</p>
                  </div>
                  <div className="flex text-center items-center gap-2 mt-4">
                    <h1 className="text-[48px] font-bold text-[#1F1A1A]" style={{ fontFamily: 'Montserrat' }}>88.2</h1>
                  </div>
                  <div className="flex text-center items-center gap-2 mt-4">
                    <h1 className="text-[16px] text-[#3D6658]" style={{ fontFamily: 'Inter' }}>98% Accuracy</h1>
                  </div>
                </div>
                {/* Texts Completed Card */}
                 <div className="flex flex-col p-6 bg-[#F6EBEA] w-85 h-50 rounded-[10px] shadow-md">
                  <div className="flex flex-row text-center items-center gap-2">
                    <img src={TextsCompleted} alt="Texts Completed" className="w-6 h-6"></img>
                    <p className="text-[16px] text-[#514442] font-semibold" style={{ fontFamily: 'Inter' }}>Texts Completed</p>
                  </div>
                  <div className="flex text-center items-center gap-2 mt-4">
                    <h1 className="text-[48px] font-bold text-[#1F1A1A]" style={{ fontFamily: 'Montserrat' }}>1,402</h1>
                  </div>
                  <div className="flex text-center items-center gap-2 mt-4">
                    <h1 className="text-[16px] text-[#514442]" style={{ fontFamily: 'Inter' }}>Across all categories</h1>
                  </div>
                </div>
              </div>
            </div>
        </div>
       </>
    );
}