import { useState } from 'react';

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <nav className="w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between md:grid md:grid-cols-3 items-center h-16 md:h-20">
                    {/* Logo */}
                    <div className="flex justify-start flex-shrink-0">
                        <h1 className="text-[#82524D] font-bold text-[24px] sm:text-xl md:text-2xl" style={{ fontFamily: 'Montserrat' }}>
                            TypeQuill
                        </h1>
                    </div>

                    {/* Desktop Navigation - centered*/}
                    <div className="hidden md:flex justify-center">
                        <div className="flex gap-6 text-sm md:text-base text-[#566252]" style={{ fontFamily: 'Inter' }}>
                            <a href="#" className="hover:text-[#514442] hover:underline hover:underline-offset-4 hover:decoration-[#82524D] hover:font-bold transition-colors">
                                Practice
                            </a>
                            <a href="#" className="hover:text-[#514442] hover:underline hover:underline-offset-4 hover:decoration-[#82524D] hover:font-bold transition-colors">
                                Compete
                            </a>
                            <a href="#" className="hover:text-[#514442] hover:underline hover:underline-offset-4 hover:decoration-[#82524D] hover:font-bold transition-colors">
                                Leaderboard
                            </a>
                            <a href="#" className="hover:text-[#514442] hover:underline hover:underline-offset-4 hover:decoration-[#82524D] hover:font-bold transition-colors">
                                About
                            </a>
                        </div>
                    </div>

                    {/* Desktop Buttons + Mobile Menu */}
                    <div className="flex items-center justify-end gap-4">
                        <div className="hidden md:flex items-center gap-3">
                            <button className="px-4 py-2 text-[#566252] hover:text-[#514442] transition-colors hover:cursor-pointer" style={{ fontFamily: 'Inter' }}>
                                Login
                            </button>
                            <button className="px-4 py-2 bg-[#82524D] text-white rounded-lg hover:bg-[#6b3f36] transition-colors hover:cursor-pointer" style={{ fontFamily: 'Inter' }}>
                                Sign Up
                            </button>
                        </div>
                        <button
                            onClick={toggleMenu}
                            className="md:hidden p-2 rounded-md text-[#566252] hover:text-[#514442] hover:cursor-pointer"
                            aria-label="Toggle menu"
                        >
                            {isMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation Menu */}
                {isMenuOpen && (
                    <div className="md:hidden pb-4">
                        <div className="flex flex-col gap-4 text-[#566252]" style={{ fontFamily: 'Inter' }}>
                            <a href="#" className="hover:text-[#514442] hover:underline hover:underline-offset-4 hover:decoration-[#82524D] hover:font-bold transition-colors py-2">
                                Practice
                            </a>
                            <a href="#" className="hover:text-[#514442] hover:underline hover:underline-offset-4 hover:decoration-[#82524D] hover:font-bold transition-colors py-2">
                                Compete
                            </a>
                            <a href="#" className="hover:text-[#514442] hover:underline hover:underline-offset-4 hover:decoration-[#82524D] hover:font-bold transition-colors py-2">
                                Leaderboard
                            </a>
                            <a href="#" className="hover:text-[#514442] hover:underline hover:underline-offset-4 hover:decoration-[#82524D] hover:font-bold transition-colors py-2">
                                About
                            </a>
                            <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
                                <button className="w-full px-4 py-2 text-[#566252] hover:text-[#514442] transition-colors border border-[#566252] rounded-lg hover:cursor-pointer">
                                    Login
                                </button>
                                <button className="w-full px-4 py-2 bg-[#82524D] text-white rounded-lg hover:bg-[#6b3f36] transition-colors hover:cursor-pointer">
                                    Sign Up
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}