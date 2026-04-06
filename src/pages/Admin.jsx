import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCheckins, removeCheckin, removeMultipleCheckins, clearAllData, STAFF_LIST, saveCheckin } from '../lib/db';
import { format } from 'date-fns';
import { Lock, Download, Trash2, ArrowLeft, Printer, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
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
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  const [selectedIds, setSelectedIds] = useState([]);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualDate, setManualDate] = useState(new Date());
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [showManualDropdown, setShowManualDropdown] = useState(false);
  const manualFilteredStaff = manualSearchQuery.trim() === '' ? [] : STAFF_LIST.filter(s => s.name.includes(manualSearchQuery));

  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      
      // Supabase Realtime (웹소켓) 기능 연결: 데이터베이스 변경 시 즉시 갱신
      const channel = supabase
        .channel('admin-checkins')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, (payload) => {
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
    // 데이터는 렌더링 시 sortedData에서 자동 정렬되므로 여기서 중복으로 정렬할 필요가 없음
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

    let currentRowIdx = 3;
    STAFF_LIST.forEach((staff, index) => {
      const row = [staff.id, staff.role, staff.name];
      
      weekdays.forEach(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        // raw data 자체(data)에서 누적 조회
        const checkedIn = data.find(c => c.name === staff.name && c.date === dateStr);
        if (checkedIn) {
          row.push('O');
        } else {
          row.push('');
        }
      });
      
      // 엑셀 내장 함수 적용 (예: COUNTIF(D3:Z3, "O"))
      const endColLetter = String.fromCharCode(64 + 3 + weekdays.length);
      row.push({ formula: `COUNTIF(D${currentRowIdx}:${endColLetter}${currentRowIdx}, "O")` });
      
      const newRow = worksheet.addRow(row);
      
      const isFifthRow = (index + 1) % 5 === 0;
      const isLastRow = (index + 1) === STAFF_LIST.length;
      const bottomStyle = (isFifthRow || isLastRow) ? 'medium' : 'thin';

      newRow.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style:'thin' }, left: { style:'thin' }, bottom: { style: bottomStyle }, right: { style:'thin' } };
        // 순번(1)과 직(2) 표시에만 연한 노란색
        if (colNumber === 1 || colNumber === 2) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
        }
      });
      currentRowIdx++;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${year}년_${month + 1}월_석식체크.xlsx`);
  };

  const getCumulativeCount = (name) => {
    if (viewMode === 'all') {
      return data.filter(d => d.name === name).length;
    } else {
      // 날짜별 보기 모드일 때는 선택된 달의 누적 횟수만 계산
      const targetMonthPrefix = selectedDate.substring(0, 7); // 'yyyy-MM'
      return data.filter(d => d.name === name && d.date.startsWith(targetMonthPrefix)).length;
    }
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

  const handleDeleteMultiple = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`${selectedIds.length}개의 데이터가 완전히 삭제되며 복구할 수 없습니다. 그래도 삭제하시겠습니까?`)) {
      try {
        await removeMultipleCheckins(selectedIds);
      } catch (err) {
        alert("데이터 삭제 중 오류가 발생했습니다.");
      }
      setSelectedIds([]);
      loadData();
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(displayedData.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (e, id) => {
    if (e.target.checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    }
  };

  const handleManualSubmit = async () => {
    try {
      if (!manualDate) {
        alert("날짜를 명확히 선택해주세요.");
        return;
      }
      
      const parsedDate = new Date(manualDate);
      if (isNaN(parsedDate.getTime())) {
        alert("유효하지 않은 날짜입니다.");
        return;
      }

      const day = parsedDate.getDay();
      if (day === 0 || day === 6) {
        alert("선택한 날짜는 주말입니다. 평일을 선택해주세요.");
        return;
      }

      const inputName = manualSearchQuery.trim();
      const staff = STAFF_LIST.find(s => s.name === inputName);
      if (!staff) {
        alert("입력하신 이름이 교직원 명단에 없습니다. 이름을 다시 확인해주세요.");
        return;
      }

      const dateStr = format(parsedDate, 'yyyy-MM-dd');
      const exists = data.find(d => d.name === staff.name && d.date === dateStr);
      if (exists) {
        alert("이미 해당 날짜에 기록이 존재합니다.");
        return;
      }

      const result = await saveCheckin(staff.name, dateStr);
      if (!result) {
        alert("데이터베이스 저장 요청 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
        return;
      }
      
      setIsManualEntryOpen(false);
      setManualSearchQuery('');
      setManualDate(new Date());
      loadData();
    } catch (error) {
      console.error(error);
      alert("알 수 없는 오류가 발생했습니다: " + error.message);
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

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuth');
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...displayedData].sort((a, b) => {
    const staffA = getStaffInfo(a.name);
    const staffB = getStaffInfo(b.name);
    
    let aValue, bValue;
    switch (sortConfig.key) {
      case 'id':
        aValue = staffA.id === '-' ? 999 : parseInt(staffA.id, 10);
        bValue = staffB.id === '-' ? 999 : parseInt(staffB.id, 10);
        break;
      case 'role':
        aValue = staffA.role;
        bValue = staffB.role;
        break;
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'date':
        aValue = a.date;
        bValue = b.date;
        break;
      case 'timestamp':
        aValue = a.timestamp;
        bValue = b.timestamp;
        break;
      case 'cumulative':
        aValue = getCumulativeCount(a.name);
        bValue = getCumulativeCount(b.name);
        break;
      default:
        aValue = a.timestamp;
        bValue = b.timestamp;
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} style={{ color: '#d1d5db', marginLeft: '4px' }} />;
    if (sortConfig.direction === 'asc') return <ArrowUp size={14} style={{ color: '#3b82f6', marginLeft: '4px' }} />;
    return <ArrowDown size={14} style={{ color: '#3b82f6', marginLeft: '4px' }} />;
  };

  if (!isAuthenticated) {
    return (
      <div className="animate-up" style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
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
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ textAlign: 'left', margin: 0 }}>영양교사 대시보드</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn primary" style={{ width: 'auto', backgroundColor: '#3b82f6', color: 'white' }} onClick={() => setIsManualEntryOpen(true)}>
            수동 데이터 입력
          </button>
          <button className="btn ghost" style={{ width: 'auto' }} onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </div>

      <div className="glass-card no-print">
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
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={sortedData.length > 0 && selectedIds.length === sortedData.length}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }} onClick={() => handleSort('id')}>
                  <span style={{ display:'inline-flex', alignItems:'center' }}>순번 {renderSortIcon('id')}</span>
                </th>
                <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }} onClick={() => handleSort('role')}>
                  <span style={{ display:'inline-flex', alignItems:'center' }}>직위 {renderSortIcon('role')}</span>
                </th>
                <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }} onClick={() => handleSort('name')}>
                  <span style={{ display:'inline-flex', alignItems:'center' }}>이름 {renderSortIcon('name')}</span>
                </th>
                <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }} onClick={() => handleSort('date')}>
                  <span style={{ display:'inline-flex', alignItems:'center' }}>날짜 {renderSortIcon('date')}</span>
                </th>
                <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }} onClick={() => handleSort('timestamp')}>
                  <span style={{ display:'inline-flex', alignItems:'center' }}>체크 시간 {renderSortIcon('timestamp')}</span>
                </th>
                <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }} onClick={() => handleSort('cumulative')}>
                  <span style={{ display:'inline-flex', alignItems:'center' }}>
                    {viewMode === 'all' 
                      ? "전체 누적 횟수" 
                      : `${parseInt(selectedDate.substring(5, 7), 10)}월의 누적 횟수`}
                    {renderSortIcon('cumulative')}
                  </span>
                </th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>기록이 없습니다.</td>
                </tr>
              ) : (
                sortedData.map((item) => {
                  const staff = getStaffInfo(item.name);
                  return (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item.id)}
                        onChange={(e) => handleSelectOne(e, item.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
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

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid #e5e7eb', paddingBottom: '1.5rem' }}>
          <button 
            className="btn danger" 
            onClick={handleDeleteMultiple}
            disabled={selectedIds.length === 0}
            style={{ 
              width: 'auto', margin: 0, padding: '0.6rem 1.5rem', 
              opacity: selectedIds.length === 0 ? 0.4 : 1,
              cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            선택된 데이터 삭제 ({selectedIds.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
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

      {isManualEntryOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '400px', backgroundColor: '#fff', padding: '2rem', borderRadius: '20px' }}>
            <h2 style={{ marginTop: 0, textAlign: 'center', color: '#111827' }}>수동 데이터 입력</h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#374151', fontSize: '0.9rem', fontWeight: 500 }}>날짜 선택</label>
              <DatePicker
                selected={manualDate}
                onChange={(date) => setManualDate(date)}
                locale={ko}
                dateFormat="yyyy-MM-dd"
                className="custom-datepicker"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '2rem', position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#374151', fontSize: '0.9rem', fontWeight: 500 }}>이름 입력</label>
              <input
                type="text"
                placeholder="교직원 이름을 입력하세요"
                value={manualSearchQuery}
                onFocus={() => setShowManualDropdown(true)}
                onChange={(e) => {
                  setManualSearchQuery(e.target.value);
                  setShowManualDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowManualDropdown(false), 200)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '1rem', outline: 'none' }}
              />
              
              {showManualDropdown && manualFilteredStaff.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, background: 'white',
                  borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  maxHeight: '150px', overflowY: 'auto', zIndex: 10, marginTop: '4px'
                }}>
                  {manualFilteredStaff.map(s => (
                    <div 
                      key={s.id} 
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setManualSearchQuery(s.name);
                        setShowManualDropdown(false);
                      }}
                      style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                    >
                      <span style={{ color: '#6b7280', fontSize: '0.85rem', marginRight: '8px' }}>{s.role}</span>
                      <span style={{ fontWeight: 500, color: '#111827' }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn success" style={{ flex: 1, margin: 0, padding: '0.75rem' }} onClick={handleManualSubmit}>
                확인
              </button>
              <button className="btn ghost" style={{ flex: 1, margin: 0, padding: '0.75rem', backgroundColor: '#f3f4f6' }} onClick={() => setIsManualEntryOpen(false)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
