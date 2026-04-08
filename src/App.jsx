import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import { fetchStaffList } from './lib/db';
import { Loader2 } from 'lucide-react';

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(false);
  const schoolId = localStorage.getItem('school_id');

  useEffect(() => {
    const initApp = async () => {
      // 학교가 미설정된 기기라면 데이터 패치를 패스하고, 나중에 Admin 페이지에서 설정하도록 둠
      if (!schoolId) {
        setIsInitializing(false);
        return;
      }
      const success = await fetchStaffList(schoolId);
      if (!success) {
        setInitError(true);
      }
      setIsInitializing(false);
    };
    initApp();
  }, [schoolId]);

  if (isInitializing) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
        <Loader2 className="animate-spin" size={48} color="#22c55e" style={{ marginBottom: '1rem' }} />
        <h2 style={{ color: '#166534' }}>시스템 연동 중...</h2>
        <p style={{ color: '#15803d' }}>학교 서버에서 데이터를 준비하고 있습니다.</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fef2f2' }}>
        <h2 style={{ color: '#b91c1c' }}>시스템 접속 오류</h2>
        <p style={{ color: '#991b1b' }}>할당된 학교 데이터를 불러오지 못했습니다.</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={schoolId ? <Home /> : <Navigate to="/admin" replace />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;
