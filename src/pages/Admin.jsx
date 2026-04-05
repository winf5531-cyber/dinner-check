import { useState, useEffect } from 'react';
import { getCheckins, removeCheckin, clearAllData } from '../lib/db';
import { format } from 'date-fns';
import { Lock, Download, Trash2, ArrowLeft, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('adminAuth') === 'true';
  });
  const [data, setData] = useState([]);
  const [viewMode, setViewMode] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      // 실시간 데이터 감지 (5초마다 조용히 체크)
      const interval = setInterval(() => {
        loadData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    const raw = await getCheckins();
    raw.sort((a, b) => {
      // 1순위: 날짜 내림차순 (최신 날짜가 위로)
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      // 2순위: 이름 가나다 오름차순
      return a.name.localeCompare(b.name);
    });
    setData(raw);
  };

  const displayedData = data.filter(item => {
    if (viewMode === 'all') return true;
    return item.date === selectedDate;
  });

  const handleLogin = () => {
    if (password === '1234') {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuth', 'true');
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const handleExport = () => {
    let exportData = displayedData;
    if (exportData.length === 0) {
      exportData = [{ name: '', date: '', timestamp: new Date().toISOString() }];
    }
    const ws = XLSX.utils.json_to_sheet(exportData.map(item => ({
      '날짜': item.date || '',
      '이름': item.name || '',
      '체크시간': item.name ? format(new Date(item.timestamp), 'yyyy-MM-dd HH:mm:ss') : ''
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "석식체크");
    XLSX.writeFile(wb, `석식명부_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleDelete = async (id) => {
    if (confirm('이 기록을 삭제하시겠습니까?')) {
      await removeCheckin(id);
      loadData();
    }
  };

  const handleClearAll = async () => {
    if (confirm('정말로 모든 데이터를 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다!)')) {
      await clearAllData();
      loadData();
    }
  };

  const handlePrintQR = () => {
    window.print();
  };

  if (!isAuthenticated) {
    return (
      <div className="animate-up" style={{ textAlign: 'center' }}>
        <Lock size={48} color="#9ca3af" style={{ margin: '0 auto 1.5rem', display: 'block' }} />
        <h1>관리자 화면</h1>
        <p>비밀번호를 입력해주세요.</p>
        <div className="glass-card" style={{ marginTop: '2rem' }}>
          <input 
            type="password" 
            placeholder="비밀번호" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '1.25rem' }}
          />
          <button className="btn" onClick={handleLogin}>접속하기</button>
          
          <button className="btn ghost" style={{ marginTop: '1rem' }} onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> 메인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-up" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ textAlign: 'left', margin: 0 }}>영양교사 대시보드</h1>
        <button className="btn ghost" style={{ width: 'auto' }} onClick={() => navigate('/')}>
          뒤로
        </button>
      </div>

      <div className="glass-card no-print">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button className="btn success" onClick={handleExport} style={{ flex: 1 }}>
            <Download size={18} /> 엑셀 다운로드
          </button>
          <button className="btn ghost" onClick={handlePrintQR} style={{ flex: 1, border: '1px solid #d1d5db', backgroundColor: 'white' }}>
            <Printer size={18} /> QR코드 출력
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', padding: '1rem', borderRadius: '12px', border: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              className={`btn ${viewMode === 'daily' ? '' : 'ghost'}`} 
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              onClick={() => setViewMode('daily')}
            >
              날짜별 보기
            </button>
            <button 
              className={`btn ${viewMode === 'all' ? '' : 'ghost'}`} 
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              onClick={() => setViewMode('all')}
            >
              전체 기록 보기
            </button>
          </div>
          
          {viewMode === 'daily' && (
            <DatePicker
              selected={new Date(selectedDate)}
              onChange={(date) => {
                if (date) setSelectedDate(format(date, 'yyyy-MM-dd'));
              }}
              locale={ko}
              dateFormat="yyyy-MM-dd"
              className="custom-datepicker"
            />
          )}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>날짜</th>
                <th>체크 시간</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {displayedData.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>기록이 없습니다.</td>
                </tr>
              ) : (
                displayedData.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td><span className="badge green">{item.date}</span></td>
                    <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      {format(new Date(item.timestamp), 'HH:mm:ss')}
                    </td>
                    <td>
                      <button 
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="no-print" style={{ textAlign: 'right', marginTop: '1rem' }}>
        <button 
          className="btn danger" 
          onClick={handleClearAll} 
          style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem', backgroundColor: '#fff', color: '#ef4444', border: '1px solid #fca5a5', boxShadow: 'none' }}
        >
          데이터 전체 초기화
        </button>
      </div>

      <div className="print-only">
        <h1 style={{ fontSize: '3rem', margin: '1rem 0 1rem', textAlign: 'center', color: '#111827' }}>석식 체크 출석부</h1>
        <p style={{ fontSize: '1.5rem', marginBottom: '2rem', textAlign: 'center', color: '#374151' }}>스마트폰 카메라로<br/>아래 QR 코드를 스캔하세요!</p>
        <center>
          <div style={{ display: 'inline-block', maxWidth: '350px', padding: '1.5rem', background: 'white', border: '5px solid black', borderRadius: '20px', margin: '0 auto' }}>
            <QRCodeSVG value={`${window.location.origin}?scan=ok`} size={300} level="H" style={{ width: '100%', height: 'auto' }} />
          </div>
        </center>
      </div>
    </div>
  );
}
