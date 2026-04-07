import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getCheckins, getCheckinsByMonth, removeCheckin, removeMultipleCheckins, clearAllData, STAFF_LIST, STAFF_MAP, saveCheckin, saveStaffList } from '../lib/db';
import { format } from 'date-fns';
import { Lock, Download, Trash2, ArrowLeft, Printer, ArrowDown, ArrowUp, ArrowUpDown, Users, Plus, Save, X } from 'lucide-react';
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
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;

  const [selectedIds, setSelectedIds] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualDate, setManualDate] = useState(new Date());
  const [exportMonth, setExportMonth] = useState(new Date()); // 누락된 상태 변수 복구
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [showManualDropdown, setShowManualDropdown] = useState(false);
  const manualFilteredStaff = manualSearchQuery.trim() === '' ? [] : STAFF_LIST.filter(s => s.name.includes(manualSearchQuery) && s.name !== manualSearchQuery.trim());

  // 명단 에디터(Staff Editor) 관련 상태
  const [isStaffEditorOpen, setIsStaffEditorOpen] = useState(false);
  const [editingStaffs, setEditingStaffs] = useState([]);

  useEffect(() => {
    if (isStaffEditorOpen) {
      // 컴포넌트 마운트/팝업 로드 시 원본 데이터를 깊은 복사하여 에디터 스테이트에 부여
      setEditingStaffs(JSON.parse(JSON.stringify(STAFF_LIST)));
    }
  }, [isStaffEditorOpen]);

  const handleStaffChange = (index, field, value) => {
    const newData = [...editingStaffs];
    newData[index][field] = value;
    setEditingStaffs(newData);
  };

  const handleAddStaff = () => {
    const maxSeq = editingStaffs.reduce((max, s) => Math.max(max, parseInt(s.seq_num || 0, 10)), 0);
    setEditingStaffs([...editingStaffs, { seq_num: maxSeq + 1, role: '기타', name: '' }]);
  };

  const handleRemoveStaff = (index) => {
    const newData = [...editingStaffs];
    newData.splice(index, 1);
    setEditingStaffs(newData);
  };
  
  const handleAutoRenumber = () => {
    const newData = editingStaffs.map((s, idx) => ({ ...s, seq_num: idx + 1 }));
    setEditingStaffs(newData);
  };

  const handleSaveStaffs = async () => {
    if (!window.confirm("주의! 수정한 명단을 DB에 영구적으로 반영하시겠습니까?\n(저장 이후에는 되돌릴 수 없으며 앱 전역 데이터 구조가 변경됩니다.)")) return;
    
    // 유효하지 않은 공백 데이터 필터링
    const validStaffs = editingStaffs.filter(s => s.name.trim() !== '' && s.role.trim() !== '');
    
    // Loading State 처리 우회 대신 명시적인 알림 사용
    const result = await saveStaffList(validStaffs);
    if (result.success) {
      alert("데이터 동기화 완료! 시스템을 안전하게 재시작합니다.");
      window.location.reload(); 
    } else {
      alert("오류가 발생했습니다: " + (result.error?.message || '알 수 없는 오류'));
    }
  };

  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      
      // Supabase Realtime (웹소켓) 기능 연결: 데이터베이스 변경 시 리소스를 낭비하지 않고 로컬 상태만 즉각 업데이트
      const channel = supabase
        .channel('admin-checkins')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setData(prev => {
              const next = [payload.new, ...prev];
              return next.length > 10000 ? next.slice(0, 10000) : next; // 메모리 팽창 폭탄 방지 (DB와 동일한 1만 건 제한 엄수)
            });
          } else if (payload.eventType === 'DELETE') {
            setData(prev => prev.filter(item => item.id !== payload.old.id));
          }
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

  // 논리 모순 제거: 조회 모드나 날짜, 정렬 필터가 변경되면 선택 내역과 페이지를 초기 화면으로 리셋 (UX 동기화)
  useEffect(() => {
    setSelectedIds([]);
    setCurrentPage(1);
  }, [viewMode, selectedDate, sortConfig]);

  // 성능 모순 제거: 불필요한 재필터링 방지 (상태 변경 시 매번 계산되는 낭비 방지)
  const displayedData = useMemo(() => {
    return data.filter(item => {
      if (viewMode === 'all') return true;
      return item.date === selectedDate;
    });
  }, [data, viewMode, selectedDate]);

  const handleLogin = () => {
    if (password === '1234') {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuth', 'true');
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      // 엑셀 다운로드는 전용 'exportMonth' 캘린더 값을 기준으로 출력
      const targetDate = new Date(exportMonth);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth(); // 0-based

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

    // 엑셀 전용 API 호출: 현재 표시된 1만 건 데이터(data)에 의존하지 않고 서버에서 해당 월의 모든 데이터를 새로고침 (과거 데이터 증발 버그 차단)
    const targetMonthPrefix = format(targetDate, 'yyyy-MM');
    const monthRawData = await getCheckinsByMonth(targetMonthPrefix);

    // O(1) 검색을 위한 데이터 딕셔너리 캐싱 (매 셀마다 루프 도는 방식 제거)
    const checkinMap = {};
    monthRawData.forEach(c => {
      checkinMap[`${c.name}_${c.date}`] = true;
    });

    let currentRowIdx = 3;
    STAFF_LIST.forEach((staff, index) => {
      const row = [staff.seq_num, staff.role, staff.name];
      
      weekdays.forEach(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        // 단일 해시 키 조회로 기존 .find() 대비 수천 배 성능 폭발
        if (checkinMap[`${staff.name}_${dateStr}`]) {
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
    } catch (error) {
      console.error('Excel Export Error:', error);
      alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  // 성능 모순 제거: O(N^2) 루프 폭탄을 방지하기 위해 렌더링 전 해시 맵으로 누적 횟수를 단일 패스(O(N)) 캐싱
  const cumulativeCounts = useMemo(() => {
    const counts = {};
    if (viewMode === 'all') {
      data.forEach(d => {
        counts[d.name] = (counts[d.name] || 0) + 1;
      });
    } else {
      const targetMonthPrefix = selectedDate.substring(0, 7);
      data.forEach(d => {
        if (d.date.startsWith(targetMonthPrefix)) {
          counts[d.name] = (counts[d.name] || 0) + 1;
        }
      });
    }
    return counts;
  }, [data, viewMode, selectedDate]);

  const getStaffInfo = (name) => {
    return STAFF_MAP[name] || { role: '-', id: '-' };
  };

  const handleDelete = async (id) => {
    if (confirm('이 기록을 삭제하시겠습니까?')) {
      await removeCheckin(id);
      // loadData(); // 실시간(Realtime) 리스너가 자동 감지하여 처리하므로 중복 호출 제거
    }
  };

  const handleDeleteMultiple = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`${selectedIds.length}개의 데이터가 완전히 삭제되며 복구할 수 없습니다. 그래도 삭제하시겠습니까?`)) {
      try {
        await removeMultipleCheckins(selectedIds);
      } catch (err) {
        console.error('Delete error:', err);
        alert("데이터 삭제 중 오류가 발생했습니다.");
      }
      setSelectedIds([]);
      // loadData(); // 실시간(Realtime) 리스너로 위임하여 이중 호출 방지
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(paginatedData.map(item => item.id)); // 화면에 보이는 현재 100개 페이지만 선택 (Option 1 적용)
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

      const inputName = manualSearchQuery.replace(/\s+/g, '');
      const staff = STAFF_LIST.find(s => s.name === inputName);
      if (!staff) {
        alert("입력하신 이름이 교직원 명단에 없습니다. 이름을 다시 확인해주세요.");
        return;
      }

      const dateStr = format(parsedDate, 'yyyy-MM-dd');
      const exists = data.find(d => d.name === staff.name && d.date === dateStr);
      if (exists) {
        alert(`이미 해당 날짜에 ${staff.name} 선생님의 기록이 존재합니다.`);
        return;
      }

      const result = await saveCheckin(staff.name, dateStr);
      if (!result) {
        alert("데이터베이스 저장 요청 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
        return;
      }
      if (result.duplicate) {
        alert(`이미 해당 날짜에 ${staff.name} 선생님의 기록이 존재합니다.`);
        return;
      }
      setIsManualEntryOpen(false);
      setManualSearchQuery('');
      setManualDate(new Date());
      // loadData(); // 논리적 중복이므로 제거 (Realtime이 처리)
    } catch (error) {
      console.error(error);
      alert("알 수 없는 오류가 발생했습니다: " + error.message);
    }
  };

  const handleClearAll = async () => {
    if (confirm('정말로 모든 데이터를 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다!)')) {
      const userInput = prompt('데이터 전체 초기화를 위해 비밀번호를 입력해주세요.\n(비밀번호가 틀리면 초기화되지 않습니다)');
      if (userInput === 'Camgo!') {
        await clearAllData();
        // loadData(); // 실시간 동기화로 대체하여 중복 트랜잭션 제거
        alert('모든 데이터가 성공적으로 초기화되었습니다.');
      } else if (userInput !== null) {
        alert('비밀번호가 일치하지 않습니다. 초기화가 취소되었습니다.');
      }
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

  // 성능 최적화: 단순 문자열 입력이나 체크박스 클릭 등 무관한 상태 변경 시 막대한 연산량이 소모되는 전체 표의 재정렬(O(N log N)) 낭비를 차단
  const sortedData = useMemo(() => {
    return [...displayedData].sort((a, b) => {
      const staffA = getStaffInfo(a.name);
      const staffB = getStaffInfo(b.name);
      
      let aValue, bValue;
      switch (sortConfig.key) {
        case 'id':
          aValue = staffA.seq_num === '-' ? 999 : parseInt(staffA.seq_num, 10);
          bValue = staffB.seq_num === '-' ? 999 : parseInt(staffB.seq_num, 10);
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
          aValue = cumulativeCounts[a.name] || 0;
          bValue = cumulativeCounts[b.name] || 0;
          break;
        default:
          aValue = a.timestamp;
          bValue = b.timestamp;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [displayedData, sortConfig, cumulativeCounts]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / ITEMS_PER_PAGE));
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedData, currentPage]);

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
    <>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DatePicker
                selected={new Date(selectedDate)}
                onChange={(date) => {
                  if (date) setSelectedDate(format(date, 'yyyy-MM-dd'));
                }}
                locale={ko}
                dateFormat="yyyy-MM-dd"
                className="custom-datepicker"
              />
              {selectedDate !== format(new Date(), 'yyyy-MM-dd') && (
                <button 
                  className="btn success" 
                  style={{ width: 'auto', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                >
                  오늘로 복귀
                </button>
              )}
            </div>
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
                paginatedData.map((item) => {
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
                    <td style={{ color: '#6b7280' }}>{staff.seq_num || '-'}</td>
                    <td style={{ color: '#6b7280' }}>{staff.role}</td>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td><span className="badge green">{item.date}</span></td>
                    <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      {format(new Date(item.timestamp), 'HH:mm:ss')}
                    </td>
                    <td style={{ fontWeight: 600, color: '#3b82f6' }}>{cumulativeCounts[item.name] || 0}회</td>
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

        {/* 페이지네이션 (Pagination) 네비게이터 컨트롤 바 */}
        {sortedData.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem', padding: '1rem 0', background: '#f9fafb', borderRadius: '12px' }}>
            <button 
              className="btn disabled-opacity" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
              disabled={currentPage === 1}
              style={{ padding: '0.4rem 1rem', margin: 0, opacity: currentPage === 1 ? 0.3 : 1, width: 'auto', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db' }}
            >
              이전
            </button>
            <span style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: 600 }}>
              {currentPage} / {totalPages} <span style={{ fontWeight: 400, color: '#9ca3af' }}>페이지</span>
            </span>
            <button 
              className="btn disabled-opacity" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
              disabled={currentPage === totalPages}
              style={{ padding: '0.4rem 1rem', margin: 0, opacity: currentPage === totalPages ? 0.3 : 1, width: 'auto', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db' }}
            >
              다음
            </button>
          </div>
        )}

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', color: '#4b5563', fontWeight: 500, paddingLeft: '0.5rem' }}>
            총 <span style={{ color: '#3b82f6', fontWeight: 700 }}>{sortedData.length}</span>개의 데이터가 표시되고 있습니다.
          </div>
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
            <button 
              className="btn success" 
              onClick={handleExport} 
              disabled={isExporting}
              style={{ flex: 1, margin: 0, opacity: isExporting ? 0.7 : 1 }}
            >
              <Download size={18} /> {isExporting ? '처리 중...' : '엑셀 다운로드'}
            </button>
          </div>
          <button className="btn ghost" onClick={handlePrintQR} style={{ flex: 1, border: '1px solid #d1d5db', backgroundColor: 'white' }}>
            <Printer size={18} /> QR코드 출력
          </button>
        </div>
      </div>
      
      </div>
      
      {/* 마스터 컨트롤 패널: 명단 수정 / 전체 초기화 버튼 좌우 분리 배치 */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', padding: '1rem', background: '#f3f4f6', borderRadius: '12px' }}>
        <button 
          className="btn primary" 
          onClick={() => setIsStaffEditorOpen(true)} 
          style={{ width: 'auto', padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', margin: 0 }}
        >
          <Users size={18} style={{ marginRight: '0.5rem', display: 'inline' }} /> 명단 수정 (전입/전출 등)
        </button>

        <button 
          className="btn danger" 
          onClick={handleClearAll} 
          style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem', backgroundColor: '#fff', color: '#ef4444', border: '1px solid #fca5a5', boxShadow: 'none', margin: 0 }}
        >
          데이터 전체 초기화
        </button>
      </div>

      <div className="print-only">
        <h1 style={{ fontSize: '3rem', margin: '1rem 0 1rem', textAlign: 'center', color: '#111827' }}>석식 체크 출석부</h1>
        <p style={{ fontSize: '1.5rem', marginBottom: '2rem', textAlign: 'center', color: '#374151' }}>스마트폰 카메라로<br/>아래 QR 코드를 스캔하세요!</p>
        <center>
          <div style={{ display: 'inline-block', maxWidth: '350px', padding: '1.5rem', background: 'white', border: '5px solid black', borderRadius: '20px', margin: '0 auto' }}>
            <QRCodeSVG value={`${window.location.origin}?token=dinner_pass_xyz_99812A`} size={300} level="H" style={{ width: '100%', height: 'auto' }} />
          </div>
        </center>
      </div>

      {/* 명단 수정 에디터 모달 (Staff Editor Modal) */}
      {isStaffEditorOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-card animate-up" style={{ width: '95%', maxWidth: '600px', maxHeight: '90vh', backgroundColor: '#fff', padding: '0', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
              <h2 style={{ margin: 0, color: '#111827', fontSize: '1.4rem' }}><Users size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px', color: '#3b82f6'}} />명단 수정 박스</h2>
              <button 
                onClick={() => setIsStaffEditorOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Toolbar */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '0.5rem', background: '#fff' }}>
              <button className="btn success" onClick={handleAddStaff} style={{ width: 'auto', padding: '0.5rem 1rem', margin: 0, fontSize: '0.9rem' }}>
                <Plus size={16} /> 행 1개 추가
              </button>
              <button className="btn ghost" onClick={handleAutoRenumber} style={{ width: 'auto', padding: '0.5rem 1rem', margin: 0, fontSize: '0.9rem', border: '1px solid #d1d5db' }}>
                순번 자동 정렬 (1번부터)
              </button>
            </div>

            {/* List Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0', background: '#f3f4f6' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#e5e7eb', zIndex: 1 }}>
                  <tr>
                    <th style={{ width: '15%', padding: '0.75rem', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' }}>순번</th>
                    <th style={{ width: '25%', padding: '0.75rem', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' }}>직위</th>
                    <th style={{ width: '45%', padding: '0.75rem', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' }}>성명</th>
                    <th style={{ width: '15%', padding: '0.75rem', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {editingStaffs.map((s, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
                      <td style={{ padding: '0.5rem' }}>
                        <input 
                          type="number" 
                          value={s.seq_num} 
                          onChange={(e) => handleStaffChange(index, 'seq_num', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', textAlign: 'center', border: '1px solid #d1d5db', borderRadius: '6px' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input 
                          type="text" 
                          value={s.role} 
                          onChange={(e) => handleStaffChange(index, 'role', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', textAlign: 'center', border: '1px solid #d1d5db', borderRadius: '6px' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input 
                          type="text" 
                          value={s.name} 
                          onChange={(e) => handleStaffChange(index, 'name', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', textAlign: 'center', border: '1px solid #3b82f6', borderRadius: '6px', fontWeight: 'bold' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <button 
                          onClick={() => handleRemoveStaff(index)}
                          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {editingStaffs.length === 0 && (
                     <tr><td colSpan="4" style={{ textAlign:'center', padding:'2rem', color:'#6b7280' }}>명단이 완전히 비었습니다!</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', background: '#f9fafb' }}>
              <button 
                className="btn primary" 
                onClick={handleSaveStaffs} 
                style={{ flex: 1, margin: 0, padding: '1rem', backgroundColor: '#ea580c', color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}
              >
                <Save size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> 최종 DB 영구 저장
              </button>
            </div>
          </div>
        </div>
      )}

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
                  setManualSearchQuery(e.target.value.replace(/\s+/g, ''));
                  setShowManualDropdown(true);
                }}
                onBlur={() => setShowManualDropdown(false)}
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
                      className="dropdown-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setManualSearchQuery(s.name);
                        setShowManualDropdown(false);
                        document.activeElement?.blur();
                      }}
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
    </>
  );
}
