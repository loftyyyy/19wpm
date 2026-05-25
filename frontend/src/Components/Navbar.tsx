export default function Navbar() {

    return (
        <div className="flex flex-row w-30 h-10">
            <div className="px-50 flex items-center justify-center">
                <h1 className="text-[#82524D] font-bold text-[24px]" style={{ fontFamily: 'Montserrat' }}>
                    TypeQuill
                </h1>
                <div className="ml-100 flex flex-row gap-3 text-[16px] text-[#566252]" style={{ fontFamily: 'Inter' }}>
                    <a href="#" className="no-underline">
                        Practice
                    </a>
                    <a href="#" className="no-underline">
                        Compete
                    </a>
                    <a href="#" className="no-underline">
                        Leaderboard
                    </a>
                    <a href="#" className="no-underline">
                        About
                    </a>
                </div>
                <div className="ml-130 flex items-center gap-2">
                    <button className="w-20">
                        <a href="#" className="no-underline text-[#566252]" style={{ fontFamily: 'Inter' }}>
                            Login
                        </a>
                    </button>
                     <button className="w-20 h-9 bg-[#82524D] rounded-[10px]">
                        <a href="#" className="no-underline text-white" style={{ fontFamily: 'Inter' }}>
                            Sign Up
                        </a>
                    </button>
                </div>
            </div>
        </div>
    );
}