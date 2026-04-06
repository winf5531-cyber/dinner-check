import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCheckins, removeCheckin, clearAllData, STAFF_LIST } from '../lib/db';
import { format } from 'date-fns';
import { Lock, Download, Trash2, ArrowLeft, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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
  const [exportMonth, setExportMonth] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      
      // Supabase Realtime (웹소켓) 기능 연결: 데이터베이스 변경 시 즉시 갱신
      const channel = supabase
        .channel('admin-checkins')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkins' }, (payload) => {
          loadData();
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    const raw = await getCheckins();
    raw.sort((a, b) => {
      const staffA = STAFF_LIST.find(s => s.name === a.name);
      const staffB = STAFF_LIST.find(s => s.name === b.name);
      const idA = staffA ? staffA.id : 999;
      const idB = staffB ? staffB.id : 999;
      
      // 1순위: 순번 오름차순
      if (idA !== idB) return idA - idB;

      // 2순위: 날짜 내림차순 (최신 날짜가 위로)
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return 0;
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

  const handleExport = async () => {
    const year = exportMonth.getFullYear();
    const month = exportMonth.getMonth(); // 0-based

    // 평일 계산
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdays = [];
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        if (d.getDay() !== 0 && d.getDay() !== 6) { // Mon-Fri
            weekdays.push(d);
        }
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${month + 1}월 출석`);

    const lastColIndex = 3 + weekdays.length + 1;

    worksheet.mergeCells(1, 1, 1, lastColIndex);
    worksheet.getCell(1, 1).value = `${month + 1}월 교직원 석식 확인`;
    worksheet.getCell(1, 1).font = { size: 16, bold: true };
    worksheet.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    const headerRow = ['순번', '직', '성명', ...weekdays.map(d => `${d.getDate()}일(${['일','월','화','수','목','금','토'][d.getDay()]})`), '총'];
    worksheet.addRow(headerRow);
    const headerRowObj = worksheet.getRow(2);
    headerRowObj.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style:'thin' }, left: { style:'thin' }, bottom: { style:'thin' }, right: { style:'thin' } };
    });
    worksheet.getCell(2, lastColIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };

    worksheet.getColumn(1).width = 6;
    worksheet.getColumn(2).width = 10;
    worksheet.getColumn(3).width = 12;
    for (let i = 0; i < weekdays.length; i++) {
      worksheet.getColumn(4 + i).width = 11;
    }
    worksheet.getColumn(lastColIndex).width = 8;

    STAFF_LIST.forEach((staff) => {
      const row = [staff.id, staff.role, staff.name];
      let cumulative = 0;
      
      weekdays.forEach(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        // raw data 자체(data)에서 누적 조회
        const checkedIn = data.find(c => c.name === staff.name && c.date === dateStr);
        if (checkedIn) {
          row.push('O');
          cumulative++;
        } else {
          row.push('');
        }
      });
      
      row.push(cumulative);
      
      const newRow = worksheet.addRow(row);
      newRow.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style:'thin' }, left: { style:'thin' }, bottom: { style:'thin' }, right: { style:'thin' } };
        // 순번(1)과 직(2) 표시에만 연한 노란색
        if (colNumber === 1 || colNumber === 2) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${year}년_${month + 1}월_석식체크.xlsx`);
  };

  const getCumulativeCount = (name) => {
    return data.filter(d => d.name === name).length;
  };

  const getStaffInfo = (name) => {
    return STAFF_LIST.find(s => s.name === name) || { role: '-', id: '-' };
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
    <div className="animate-up" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ textAlign: 'left', margin: 0 }}>영양교사 대시보드</h1>
        <button className="btn ghost" style={{ width: 'auto' }} onClick={() => navigate('/')}>
          뒤로
        </button>
      </div>

      <div className="glass-card no-print">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flex: 2, gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.5)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: '0.9rem', color: '#6b7280', whiteSpace: 'nowrap' }}>출석부 월 선택:</span>
            <DatePicker
              selected={exportMonth}
              onChange={(date) => setExportMonth(date)}
              locale={ko}
              dateFormat="yyyy년 MM월"
              showMonthYearPicker
              className="custom-datepicker"
            />
            <button className="btn success" onClick={handleExport} style={{ flex: 1, margin: 0 }}>
              <Download size={18} /> 엑셀 다운로드
            </button>
          </div>
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
                <th>순번</th>
                <th>직위</th>
                <th>이름</th>
                <th>날짜</th>
                <th>체크 시간</th>
                <th>누적 횟수</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {displayedData.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>기록이 없습니다.</td>
                </tr>
              ) : (
                displayedData.map((item) => {
                  const staff = getStaffInfo(item.name);
                  return (
                  <tr key={item.id}>
                    <td style={{ color: '#6b7280' }}>{staff.id}</td>
                    <td style={{ color: '#6b7280' }}>{staff.role}</td>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td><span className="badge green">{item.date}</span></td>
                    <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      {format(new Date(item.timestamp), 'HH:mm:ss')}
                    </td>
                    <td style={{ fontWeight: 600, color: '#3b82f6' }}>{getCumulativeCount(item.name)}회</td>
                    <td>
                      <button 
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                  );
                })
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
