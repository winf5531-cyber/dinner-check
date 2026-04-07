import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CheckCircle, Utensils, Download } from 'lucide-react';
import { saveCheckin, checkDuplicateCheckin, removeCheckinByNameAndDate, STAFF_LIST } from '../lib/db';

// InstallPrompt 기능 및 버튼 삭제됨 (QR 매일 스캔 정책과 충돌)

export default function Home() {
  const [name, setName] = useState('');
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [isScanned, setIsScanned] = useState(false);
  const [filteredNames, setFilteredNames] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [today, setToday] = useState(format(new Date(), 'yyyy-MM-dd'));
  const submitLock = useRef(false);

  const displayDate = format(new Date(), 'M월 d일 (EEEE)', { locale: ko });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const freshToday = format(new Date(), 'yyyy-MM-dd');
        if (freshToday !== today) {
          setToday(freshToday);
          setHasCheckedIn(false); // 날짜가 바뀌면 뷰어 리셋
          window.location.reload(); // 가장 깔끔하게 처음부터 다시 로딩
        }
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [today]);

  useEffect(() => {
    // 1. QR 스캔 파라미터 확인 (폭탄 암호 적용)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token') === 'dinner_pass_xyz_99812A') {
      sessionStorage.setItem('scanned_today', today);
      setIsScanned(true);
      // 암호가 적힌 원래 URL을 즉시, 현재 주소창에서 흔적도 없이 증발시킴
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const scannedStatus = sessionStorage.getItem('scanned_today');
      if (scannedStatus === today) {
        setIsScanned(true);
      }
    }

    // 2. 본인이 썼던 이름이 로컬에 남아있으면 자동입력
    const savedName = localStorage.getItem('my_name');
    if (savedName) {
      setName(savedName);
      
      // 이미 체크했는지 단일 쿼리로 확인 (전체 DB 호출 방지)
      const checkStatus = async () => {
        const alreadyChecked = await checkDuplicateCheckin(savedName, today);
        if(alreadyChecked) {
          setHasCheckedIn(true);
        }
      };
      checkStatus();
    }

  }, [today]);

  const handleNameChange = (e) => {
    const val = e.target.value.replace(/\s+/g, '');
    setName(val);
    if (!val) {
      setShowDropdown(false);
      return;
    }
    // 입력한 이름(공백 제거됨)으로 시작하는 명단 필터링
    const matches = STAFF_LIST.filter(t => t.name.startsWith(val) && t.name !== val);
    setFilteredNames(matches);
    setShowDropdown(matches.length > 0);
  };

  const handleSelectName = (tName) => {
    setName(tName);
    setShowDropdown(false);
  };

  const handleCheckin = async () => {
    if (isSubmitting || submitLock.current) return;
    
    // 이중 탭으로 인한 레이스 컨디션(동시 중복 데이터 삽입) 완벽 차단용 락
    submitLock.current = true;
    setIsSubmitting(true);

    const currentToday = format(new Date(), 'yyyy-MM-dd');

    // 화면이 켜진 상태로 자정이 넘어가는 극단적 경우(물리적 QR스캔 우회) 원천 차단
    if (sessionStorage.getItem('scanned_today') !== currentToday) {
      alert("세션 유효기간(오늘)이 지났거나 만료되었습니다. 급식실 코드를 다시 스캔하세요.");
      window.location.reload();
      return;
    }

    const cleanName = name.replace(/\s+/g, '');
    
    if (!cleanName) {
      alert('성함을 입력해주세요!');
      submitLock.current = false;
      setIsSubmitting(false);
      return;
    }

    // 공백이 완전히 제거된 깨끗한 이름이 명단에 있는지 확인
    const isStaff = STAFF_LIST.some(staff => staff.name === cleanName);
    if (!isStaff) {
      alert('교직원 명단에 없습니다. 영양 선생님에게 문의해 주세요.');
      submitLock.current = false;
      setIsSubmitting(false);
      return;
    }

    const day = new Date().getDay();
    if (day === 0 || day === 6) {
      alert('주말에는 출석 체크를 할 수 없습니다.');
      submitLock.current = false;
      setIsSubmitting(false);
      return;
    }

    // 네트워크 오류 등으로 저장이 실패하면 UI 상태를 변경하지 않음
    const result = await saveCheckin(cleanName, currentToday);
    if (!result) {
      alert('네트워크 또는 서버 오류로 출석 체크에 실패했습니다. 다시 시도해주세요.');
      submitLock.current = false;
      setIsSubmitting(false);
      return;
    }
    
    // 이미 오늘 수동 혹은 다른 기기로 체크한 경우
    if (result.duplicate) {
      alert(`선생님, 이미 오늘(${format(new Date(), 'M월 d일')}) 출석체크가 완료되어 있습니다!`);
      localStorage.setItem('my_name', cleanName);
      setHasCheckedIn(true);
      submitLock.current = false;
      setIsSubmitting(false);
      return;
    }

    localStorage.setItem('my_name', cleanName);
    setHasCheckedIn(true);
    setAnimate(true);
    
    setTimeout(() => {
      setAnimate(false);
      submitLock.current = false;
      setIsSubmitting(false);
    }, 1500);
  };

  // 출석체크 취소 버튼 클릭 시 첫 번째 경고창 (모달) 띄우기
  const handleCancelClick = () => {
    setShowCancelModal(true);
  };

  // 모달 닫기
  const closeCancelModal = () => {
    setShowCancelModal(false);
  };

  // 첫 번째 경고창(모달)에서 '예'를 누른 경우 바로 삭제 진행 (1단계로 단일화)
  const confirmCancelCheckin = () => {
    handleFinalCancelCheckin();
  };

  const handleFinalCancelCheckin = async () => {
    if (isSubmitting || submitLock.current) return;

    setShowCancelModal(false);
    submitLock.current = true;
    setIsSubmitting(true);
    const currentToday = format(new Date(), 'yyyy-MM-dd');
    const cleanName = name.replace(/\s+/g, '');
    
    const success = await removeCheckinByNameAndDate(cleanName, currentToday);
    if (!success) {
      alert('데이터 삭제 취소 중 오류가 발생했습니다. 다시 시도해주세요.');
      submitLock.current = false;
      setIsSubmitting(false);
      return;
    }
    setHasCheckedIn(false);
    submitLock.current = false;
    setIsSubmitting(false);
    // 이름은 그대로 두어 다시 수정/입력할 수 있게 합니다.
  };

  if (!isScanned) {
    return (
      <div className="animate-up" style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div className="header">
          <Utensils size={40} color="#9ca3af" style={{ marginBottom: '10px' }} />
          <h1 style={{ color: '#374151' }}>출석 체크 대기 중</h1>
        </div>
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>카메라를 켜주세요!</h2>
          <p style={{ color: '#4b5563', lineHeight: '1.6' }}>급식실에 부착된 <strong>QR 코드</strong>를<br/>기본 카메라 앱으로 스캔해야만<br/>이 화면이 열리며 출석체크가 가능합니다.<br/><br/><span style={{ fontSize: '0.85rem', opacity: 0.8 }}>(집이나 교무실에서의 원격 체크 방지)</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-up" style={{ maxWidth: '480px', margin: '0 auto' }}>
      <div className="header">
        <Utensils size={40} color="#3b82f6" style={{ marginBottom: '10px' }} />
        <h1>석식 체크</h1>
        <p>오늘도 고생 많으셨습니다!</p>
      </div>

      <div className="glass-card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div className="date-display animate-pulse">{displayDate}</div>
        </div>

        {!hasCheckedIn ? (
          <>
            <div className="autocomplete-container">
              <input 
                type="text" 
                placeholder="선생님 성함을 입력하세요 (일부만 입력해도 뜹니다)" 
                value={name}
                onChange={handleNameChange}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckin()}
                style={{ position: 'relative', zIndex: 60, marginBottom: showDropdown ? '0' : '1rem' }}
                onFocus={() => { if(name.trim() && filteredNames.length > 0) setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                lang="ko"
                spellCheck="false"
                autoComplete="off"
              />
              {showDropdown && (
                <ul className="dropdown-list">
                  {filteredNames.map((staff, idx) => (
                    <li 
                      key={idx} 
                      className="dropdown-item"
                      onClick={() => handleSelectName(staff.name)}
                    >
                      <span style={{ fontSize: '0.8rem', color: '#6b7280', marginRight: '0.5rem' }}>{staff.role}</span>
                      {staff.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button className="btn" disabled={isSubmitting || submitLock.current} onClick={handleCheckin}>
              <CheckCircle size={20} /> 출석 체크 완료
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 1rem', transform: animate ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.3s' }} />
            <h2 style={{ color: '#10b981', margin: '0 0 0.5rem' }}>체크가 완료되었습니다</h2>
            <p style={{ margin: 0 }}>맛있는 저녁 식사 되세요!</p>
            <button 
              className="btn ghost" 
              style={{ marginTop: '2rem' }}
              onClick={() => {
                setHasCheckedIn(false);
                setName('');
              }}
            >
               다른 분 체크 도와주기 
            </button>
            <button 
              className="btn danger" 
              style={{ marginTop: '0.8rem', backgroundColor: '#fff0f0', color: '#ef4444', border: '1px solid #fecaca', boxShadow: 'none' }}
              onClick={handleCancelClick}
            >
               잘못 눌렀어요 (출석체크 취소)
            </button>
          </div>
        )}
      </div>

      {showCancelModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div className="glass-card animate-up" style={{ width: '100%', maxWidth: '320px', backgroundColor: '#fff', padding: '2rem 1.5rem', borderRadius: '24px', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1f2937', fontSize: '1.1rem', wordBreak: 'keep-all', lineHeight: '1.5' }}>
              오늘의 출석 체크를 정말 취소하겠습니까?
            </h3>
            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
              <button 
                className="btn" 
                disabled={isSubmitting || submitLock.current}
                style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', padding: '0.8rem' }} 
                onClick={confirmCancelCheckin}
              >
                예
              </button>
              <button 
                className="btn ghost" 
                disabled={isSubmitting || submitLock.current}
                style={{ flex: 1, padding: '0.8rem', backgroundColor: '#f3f4f6' }} 
                onClick={closeCancelModal}
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
