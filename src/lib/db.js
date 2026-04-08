import { supabase } from './supabase';

export let STAFF_LIST = [];
export let STAFF_MAP = {};

export const searchSchools = async (keyword) => {
  if (!keyword || keyword.trim() === '') return [];
  const { data, error } = await supabase
    .from('schools')
    .select('id, name')
    .ilike('name', `%${keyword}%`)
    .limit(10);
  if (error) {
    console.error('Error searching schools:', error);
    return [];
  }
  return data;
};

export const fetchStaffList = async (schoolId) => {
  if (!schoolId) return false;
  
  const { data, error } = await supabase
    .from('staffs')
    .select('*')
    .eq('school_id', schoolId)
    .order('seq_num', { ascending: true });
    
  if (error) {
    console.error('Error fetching staffs:', error);
    return false;
  }
  
  if (data) {
    STAFF_LIST = data;
    
    STAFF_MAP = STAFF_LIST.reduce((acc, staff) => {
      acc[staff.name] = staff;
      return acc;
    }, {});
    
    return true;
  }
  return false;
};

export const saveStaffList = async (newList, schoolId) => {
  if (!schoolId) return { success: false, error: 'No school selected' };
  try {
    // 1. 전체 삭제 (해당 학교 데이터만 삭제하여 타 학교 격리 보호)
    const { error: deleteError } = await supabase
      .from('staffs')
      .delete()
      .eq('school_id', schoolId);
    if (deleteError) throw deleteError;
    
    // 2. 신규 목록 삽입
    const inserts = newList.map(s => ({
      seq_num: parseInt(s.seq_num || 0, 10) || 0, // 빈 칸 방어
      role: s.role || '미지정', // 빈 직위 방어
      name: s.name || '이름없음', // 빈 이름 방어
      school_id: schoolId
    }));
    
    const { error: insertError } = await supabase.from('staffs').insert(inserts);
    if (insertError) throw insertError;
    
    // 3. 로컬 캐시 동기화
    await fetchStaffList(schoolId);
    return { success: true };
  } catch (err) {
    console.error('Error saving staff list:', err);
    return { success: false, error: err };
  }
};

export const getCheckins = async (schoolId) => {
  if (!schoolId) return [];
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('school_id', schoolId)
    .order('timestamp', { ascending: false })
    .limit(10000);
  
  if (error) {
    console.error('Error fetching checkins:', error);
    return [];
  }
  return data;
};

// 엑셀 다운로드 전용 함수: 클라이언트 1만 건 제한 버그를 방지하기 위해 해당 월의 학교 데이터만 서버에서 완전 추출
export const getCheckinsByMonth = async (yearMonthStr, schoolId) => {
  if (!schoolId) return [];
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('school_id', schoolId)
    .gte('date', `${yearMonthStr}-01`)
    .lte('date', `${yearMonthStr}-31`);
    
  if (error) {
    console.error('Error fetching checkins by month:', error);
    return [];
  }
  return data;
};

export const checkDuplicateCheckin = async (name, date, schoolId) => {
  if (!schoolId) return false;
  const { data, error } = await supabase
    .from('checkins')
    .select('id')
    .eq('school_id', schoolId)
    .eq('name', name)
    .eq('date', date);
  
  if (error) {
    console.error('Error checking duplicate:', error);
    return false;
  }
  return data && data.length > 0;
};

export const saveCheckin = async (name, date, schoolId) => {
  if (!schoolId) return null;
  // DB 자체적으로도 중복 저장 방어
  const isDuplicate = await checkDuplicateCheckin(name, date, schoolId);
  if (isDuplicate) {
    return { duplicate: true }; // 중복 객체 반환
  }

  const { data, error } = await supabase
    .from('checkins')
    .insert([{ name, date, school_id: schoolId }])
    .select();
    
  if (error) {
    // 23505: Postgres UNIQUE constraint violation (동시 접속 우연 발생 시)
    if (error.code === '23505') {
      return { duplicate: true };
    }
    console.error('Error saving checkin:', error);
    return null;
  }
  return data;
};

export const removeCheckin = async (id) => {
  const { error } = await supabase
    .from('checkins')
    .delete()
    .eq('id', id);
    
  if (error) {
    console.error('Error removing checkin:', error);
  }
};

export const removeMultipleCheckins = async (ids) => {
  if (!ids || ids.length === 0) return;
  
  // URL 길이 제한(414 Error) 방지를 위해 100개씩 분할(Chunk) 전송
  const CHUNK_SIZE = 100;
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('checkins')
      .delete()
      .in('id', chunk);
      
    if (error) {
      console.error(`Error removing checkins chunk [${i} - ${i + CHUNK_SIZE}]:`, error);
      throw error;
    }
  }
};

export const removeCheckinByNameAndDate = async (name, date, schoolId) => {
  if (!schoolId) return false;
  const { error } = await supabase
    .from('checkins')
    .delete()
    .eq('school_id', schoolId)
    .eq('name', name)
    .eq('date', date);
    
  if (error) {
    console.error('Error removing checkin by name and date:', error);
    return false;
  }
  return true;
};

export const clearAllData = async (schoolId) => {
  if (!schoolId) return;
  const { error } = await supabase
    .from('checkins')
    .delete()
    .eq('school_id', schoolId); // 소속 학교 데이터만 격리 전체 삭제
    
  if (error) {
    console.error('Error clearing data:', error);
  }
};
