export default function Footer() {
    return (
        <div className="flex flex-row mt-15 ml-[155px]">
            <h1 className="text-[#566252] text-[16px] font-bold" style={{ fontFamily: 'Montserrat' }}>© 2024 TypeQuill. Crafted for focused performance.</h1>
            <div className="flex flex-row ml-auto mr-[300px] gap-4 text-[#566252] text-[14px]" style={{ fontFamily: 'Inter' }}>
                <a href="#">Support</a>
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
                <a href="#">Discord</a>
            </div>
        </div>
    );
}