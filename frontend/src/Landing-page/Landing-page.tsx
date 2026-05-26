import Navbar from '../Components/Navbar';
export default function LandingPage() {
    return (
        <>
            {/* Navbar components */}
            <Navbar />

            <div className="flex flex-col items-center justify-center px-4">
                <div className="mt-15 flex flex-row gap-2 items-center">
                    <h1 className="text-[56px] font-bold leading-tight" style={{ fontFamily: 'Montserrat' }}>Type better. Race smarter.</h1>
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
                <div className="mt-20 flex">
                    <div className="bg-[#F6EBEA] rounded-2xl w-10 h-5 shadow-md">

                    </div>
                </div>
            </div>
        </>
    )
}