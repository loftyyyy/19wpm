import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './Landing-page/Landing-page';
import LoginContainer from './LoginsContainer/LoginContainer';
import RegistrationContainer from './LoginsContainer/RegistrationContainer';

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginContainer />} />
                <Route path="/register" element={<RegistrationContainer />} />
            </Routes>
        </Router>
    );
}