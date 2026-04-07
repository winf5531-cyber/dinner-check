import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import { fetchStaffList } from './lib/db';
import { Loader2 } from 'lucide-react';

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      const success = await fetchStaffList();
      if (!success) {
        setInitError(true);
      }
      setIsInitializing(false);
    };
    initApp();
  }, []);

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
        <h2 style={{ color: '#b91c1c' }}>명단 설정 오류</h2>
        <p style={{ color: '#991b1b' }}>Supabase staffs 테이블 세팅을 확인해주세요.</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;
