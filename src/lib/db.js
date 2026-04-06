import { supabase } from './supabase';

export const STAFF_LIST = [
  { id: 1, role: '교장', name: '이정세' },
  { id: 2, role: '교감', name: '김해숙' },
  { id: 3, role: '교사', name: '윤소영' },
  { id: 4, role: '교사', name: '이재성' },
  { id: 5, role: '교사', name: '이다솜' },
  { id: 6, role: '교사', name: '남신애' },
  { id: 7, role: '교사', name: '정권택' },
  { id: 8, role: '교사', name: '노주연' },
  { id: 9, role: '교사', name: '이재원' },
  { id: 10, role: '교사', name: '정윤혁' },
  { id: 11, role: '교사', name: '조윤경' },
  { id: 12, role: '교무실무사', name: '양대모' },
  { id: 13, role: '교무실무사', name: '양은식' },
  { id: 14, role: '교사', name: '이경수' },
  { id: 15, role: '교사', name: '주승원' },
  { id: 16, role: '교사', name: '정진성' },
  { id: 17, role: '교사', name: '김용찬' },
  { id: 18, role: '교사', name: '송경하' },
  { id: 19, role: '교사', name: '박민아' },
  { id: 20, role: '교사', name: '최유빈' },
  { id: 21, role: '교사', name: '하지선' },
  { id: 22, role: '교사', name: '신태환' },
  { id: 23, role: '교사', name: '조미경' },
  { id: 24, role: '교사', name: '이소희' },
  { id: 25, role: '교사', name: '홍인선' },
  { id: 26, role: '보건교사', name: '박은옥' },
  { id: 27, role: '상담교사', name: '김가람' },
  { id: 28, role: '특수교사', name: '김한비' },
  { id: 29, role: '교사', name: '문동민' },
  { id: 30, role: '교사', name: '신혜서' },
  { id: 31, role: '교사', name: '박주영' },
  { id: 32, role: '교사', name: '윤혜인' },
  { id: 33, role: '교사', name: '진후정' },
  { id: 34, role: '교사', name: '김준무' },
  { id: 35, role: '교사', name: '안유정' },
  { id: 36, role: '교사', name: '이나래' },
  { id: 37, role: '교사', name: '김정민' },
  { id: 38, role: '교사', name: '정아름' },
  { id: 39, role: '교사', name: '박시연' },
  { id: 40, role: '교사', name: '진예빈' },
  { id: 41, role: '교사', name: '김연하' },
  { id: 44, role: '교사', name: '이정숙' },
  { id: 45, role: '교사', name: '임승우' },
  { id: 46, role: '교장', name: '김영은' },
  { id: 47, role: '교감', name: '안미진' },
  { id: 48, role: '교사', name: '김광연' },
  { id: 49, role: '교사', name: '권승준' },
  { id: 50, role: '교사', name: '신수정' },
  { id: 51, role: '교사', name: '김소연' },
  { id: 52, role: '교사', name: '조용범' },
  { id: 53, role: '교사', name: '최찬수' },
  { id: 54, role: '교사', name: '이정우' },
  { id: 55, role: '교사', name: '노남주' },
  { id: 56, role: '교사', name: '송소진' },
  { id: 57, role: '교사', name: '이예림' },
  { id: 58, role: '교사', name: '이희경' },
  { id: 59, role: '교사', name: '박지흠' },
  { id: 60, role: '교사', name: '이창현' },
  { id: 61, role: '행정실장', name: '나신애' },
  { id: 62, role: '행정부장', name: '유철숙' },
  { id: 63, role: '행정계장', name: '성승민' },
  { id: 64, role: '주무관', name: '유화석' },
  { id: 65, role: '주무관', name: '노지혜' },
  { id: 66, role: '당직원', name: '김주예' },
  { id: 67, role: '온세움', name: '양희선' },
  { id: 68, role: '온세움', name: '신학숙' },
  { id: 69, role: '온세움', name: '고준' },
  { id: 70, role: '온세움', name: '이대훈' },
  { id: 71, role: '온세움', name: '박성호' },
  { id: 72, role: '온세움', name: '김지현' },
  { id: 73, role: '온세움', name: '하승주' },
  { id: 74, role: '온세움', name: '김혜영' },
  { id: 75, role: '온세움', name: '김해원' },
  { id: 76, role: '온세움', name: '오다윤' },
  { id: 77, role: '온세움', name: '박진숙' }
];

export const getCheckins = async () => {
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .order('timestamp', { ascending: false });
  
  if (error) {
    console.error('Error fetching checkins:', error);
    return [];
  }
  return data;
};

export const saveCheckin = async (name, date) => {
  const { data, error } = await supabase
    .from('checkins')
    .insert([{ name, date }])
    .select();
    
  if (error) {
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
  const { error } = await supabase
    .from('checkins')
    .delete()
    .in('id', ids);
    
  if (error) {
    console.error('Error removing multiple checkins:', error);
    throw error;
  }
};

export const removeCheckinByNameAndDate = async (name, date) => {
  const { error } = await supabase
    .from('checkins')
    .delete()
    .eq('name', name)
    .eq('date', date);
    
  if (error) {
    console.error('Error removing checkin by name and date:', error);
  }
};

export const clearAllData = async () => {
  const { error } = await supabase
    .from('checkins')
    .delete()
    .neq('id', -999); // 모든 데이터를 안전하게 지우기 위한 더미 필터
    
  if (error) {
    console.error('Error clearing data:', error);
  }
};
