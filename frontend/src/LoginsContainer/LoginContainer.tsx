import { Link } from 'react-router-dom';
export default function LoginContainer() {
    return(
        <div className="bg-[#FFF8F7] flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-[48px] text-[#82524D] font-bold" style={{ fontFamily: 'Montserrat' }}>
                TypeHuill
            </h1>
            <div>
                <p className="text-[16px] text-[#566252]" style={{ fontFamily: 'Inter' }}>
                    Crafted for focused performance.
                </p>
            </div>

            {/* Login Form Container */}
            <div className="mt-10 flex flex-col bg-[#FFFFFF] rounded-[10px] shadow-md w-100 h-100">
                <div className="flex flex-row items-center justify-center gap-10 mt-10">
                    <div className="text-[16px] text-[#82524D] font-semibold" style={{ fontFamily: 'Inter' }}>
                        <Link to="#">LOGIN</Link>
                    </div>
                    <div className="text-[16px] text-[#82524D] font-semibold" style={{ fontFamily: 'Inter' }}>
                        <Link to="#">REGISTER</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}