import Navbar from '../Components/Navbar';
import English from '../assets/English.svg';
export default function LandingPage() {
    return (
        <>
            {/* Navbar components */}
            <Navbar />
            <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="flex flex-col items-center justify-center px-4">
                <div className="flex flex-row gap-2 items-center">
                    <h1 className="text-[56px] text-[#522A26] font-bold leading-tight" style={{ fontFamily: 'Montserrat' }}>Type better. Race smarter.</h1>
                    <div className="w-1 h-10 bg-[#C9908A] rounded-full mt-2"></div>
                </div>
                <div className="mt-8 flex flex-col max-w-3xl">
                    <p className="text-[16px] text-[#808080] text-center leading-relaxed" style={{ fontFamily: 'Inter' }}>A refined environment for focused typing practice and calm competition. Leave the anxiety behind and find your rhythm.</p>
                </div>
                <div className="mt-15 flex flex-row gap-4">
                    <button className="flex text-center justify-center items-center bg-[#C9908A] w-40 h-15 rounded-[10px] hover:cursor-pointer" style={{ fontFamily: 'Inter' }}>
                        Start Typing
                    </button>
                    <button className="flex text-center justify-center items-center bg-white border border-[#C9908A] w-40 h-15 rounded-[10px] hover:cursor-pointer" style={{ fontFamily: 'Inter' }}>
                        Join a Race
                    </button>
                </div>
                <div className="mt-15 flex flex-row items-center justify-center gap-4">
                    <div className="bg-[#F6EBEA] flex items-center justify-center p-4 gap-3 rounded-2xl w-43 h-9 shadow-md">
                        <div>
                            <button className="text-[#566252] text-[14px] font-semibold hover:cursor-pointer" style={{ fontFamily: 'Inter' }}>
                                15s
                            </button>
                        </div>
                       <div>
                             <button className="text-[#522A26] w-15 h-7 text-[14px] font-semibold hover:cursor-pointer bg-[#C9908A] rounded-2xl" style={{ fontFamily: 'Inter' }}>
                                30s
                            </button>
                       </div>
                        <div>
                            <button className="text-[#566252] text-[14px] font-semibold hover:cursor-pointer" style={{ fontFamily: 'Inter' }}>
                                60s
                            </button>
                        </div>
                    </div>
                    <div className="bg-[#D6C2C0] w-1 h-8 shadow-md rounded-[10px]"></div>
                    <div className="bg-[#F6EBEA] flex flex-row items-center justify-center gap-2 shadow-md w-28 h-9 rounded-2xl px-3 hover:cursor-pointer">
                        <img src={English} alt="English" className="w-5 h-5" />
                        <p className="text-[14px] text-[#566252] font-semibold" style={{ fontFamily: 'Inter' }}>
                            English
                        </p>
                    </div>
                </div>
            </div>
            </div>
        </>
    )
}