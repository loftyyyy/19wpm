import { useState } from 'react';

export default function LoginContainer() {
    const [activeTab, setActiveTab] = useState('login');
    
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
                    <div 
                        onClick={() => setActiveTab('login')}
                        className={`text-[16px] font-semibold cursor-pointer transition-colors pb-2 px-8 ${
                            activeTab === 'login' 
                                ? 'text-[#82524D] border-b-4 border-[#82524D]' 
                                : 'text-[#A0A0A0]'
                        }`} 
                        style={{ fontFamily: 'Inter' }}
                    >
                        LOGIN
                    </div>
                    <div 
                        onClick={() => setActiveTab('register')}
                        className={`text-[16px] font-semibold cursor-pointer transition-colors pb-2 px-8 ${
                            activeTab === 'register' 
                                ? 'text-[#82524D] border-b-4 border-[#82524D]' 
                                : 'text-[#A0A0A0]'
                        }`} 
                        style={{ fontFamily: 'Inter' }}
                    >
                        REGISTER
                    </div>
                </div>
                {/* Form Content Container */}
                <div className="flex flex-row items-center justify-center mt-20">
                    <form className="flex text-center" action="#">
                        <h1 className="text-[50px] font-bold">AFK SAKO KADALI</h1>
                    </form>
                </div>
            </div>
        </div>
    );
}