import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CheckCircle, Utensils, Download } from 'lucide-react';
import { saveCheckin, getCheckins, removeCheckinByNameAndDate, STAFF_LIST } from '../lib/db';

export default function Home() {
  const [name, setName] = useState('');
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [isScanned, setIsScanned] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [filteredNames, setFilteredNames] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const displayDate = format(new Date(), 'M월 d일 (EEEE)', { locale: ko });

  useEffect(() => {
    // 앱 설치 프롬프트 이벤트 리스너 추가
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 1. QR 스캔 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('scan') === 'ok') {
      sessionStorage.setItem('scanned_today', today);
      setIsScanned(true);
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
      
      // 이미 체크했는지 확인 (Supabase)
      const checkStatus = async () => {
        const allCheckins = await getCheckins();
        const alreadyChecked = allCheckins.some(c => c.name === savedName && c.date === today);
        if(alreadyChecked) {
          setHasCheckedIn(true);
        }
      };
      checkStatus();
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [today]);


  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (!val.trim()) {
      setShowDropdown(false);
      return;
    }
    // 중간에 포함된 이름이 아닌, 입력한 글자로 '시작'하는 이름만 필터링
    const matches = STAFF_LIST.filter(t => t.name.startsWith(val.trim()) && t.name !== val.trim());
    setFilteredNames(matches);
    setShowDropdown(matches.length > 0);
  };

  const handleSelectName = (tName) => {
    setName(tName);
    setShowDropdown(false);
  };

  const handleCheckin = async () => {
    if (!name.trim()) {
      alert('성함을 입력해주세요!');
      return;
    }
    
    // 네트워크 오류 등으로 저장이 실패하면 UI 상태를 변경하지 않음
    const result = await saveCheckin(name.trim(), today);
    if (!result) {
      alert('네트워크 또는 서버 오류로 출석 체크에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    localStorage.setItem('my_name', name.trim());
    setHasCheckedIn(true);
    setAnimate(true);
    
    setTimeout(() => {
      setAnimate(false);
    }, 1500);
  };

  const handleCancelCheckin = async () => {
    if (window.confirm('혹시 실수로 취소 버튼을 누르셨나요?\\n진짜 석식 체크를 취소하시겠습니까? (기록이 바로 삭제됩니다)')) {
      const success = await removeCheckinByNameAndDate(name.trim(), today);
      if (!success) {
        alert('데이터 삭제 취소 중 오류가 발생했습니다. 다시 시도해주세요.');
        return;
      }
      setHasCheckedIn(false);
      // 이름은 그대로 두어 다시 수정/입력할 수 있게 합니다.
    }
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
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>
            휴대폰 홈 화면에 추가해서 사용하시면 더욱 편리합니다.
          </p>
          <button 
            className="btn" 
            style={{ margin: '0.5rem auto 0', width: 'auto', padding: '0.8rem 1.5rem', fontSize: '1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            onClick={() => {
              if (!deferredPrompt) {
                alert('[안드로이드/삼성인터넷]\n화면 아래 ☰[메뉴] ➔ [추가] ➔ [홈 화면]\n\n[안드로이드/크롬]\n화면 상단 ⁝[메뉴] ➔ [앱 설치] 또는 [홈 화면에 추가]\n\n[아이폰/사파리]\n화면 아래 📤[공유] ➔ [홈 화면에 추가]');
                return;
              }
              deferredPrompt.prompt();
              deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
            }}
          >
            <Download size={20} /> 📱 스마트폰 바탕화면에 설치하기
          </button>
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
            <button className="btn" onClick={handleCheckin}>
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
              onClick={handleCancelCheckin}
            >
               잘못 눌렀어요 (출석체크 취소)
            </button>
          </div>
        )}
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>
          휴대폰 홈 화면에 추가해서 사용하시면 더욱 편리합니다.
        </p>
        <button 
          className="btn" 
          style={{ margin: '1rem auto 0', width: 'auto', padding: '0.8rem 1.5rem', fontSize: '1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          onClick={() => {
            if (!deferredPrompt) {
              alert('[안드로이드/삼성인터넷]\n화면 아래 ☰[메뉴] ➔ [추가] ➔ [홈 화면]\n\n[안드로이드/크롬]\n화면 상단 ⁝[메뉴] ➔ [앱 설치] 또는 [홈 화면에 추가]\n\n[아이폰/사파리]\n화면 아래 📤[공유] ➔ [홈 화면에 추가]');
              return;
            }
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
          }}
        >
          <Download size={20} /> 📱 스마트폰 바탕화면에 설치하기
        </button>
      </div>
    </div>
  );
}
