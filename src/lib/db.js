import { supabase } from './supabase';

export const TEACHER_LIST = [
  "신혜서", "박주영", "윤혜인", "진후정", "김준무", "안유정", "이나래", "김정민", "정아름", "박시연",
  "진예빈", "김연하", "이정숙", "임승우", "이제현", "문동민", "주승현", "윤소영", "신태환", "남신애",
  "조윤경", "박은옥", "김가람", "정진성", "정윤혁", "김응찬", "송경하", "안미진", "김광연", "권승준",
  "신수정", "김소연", "조용범", "최찬수", "이정우", "노남주", "송소진", "이예림", "이희경", "박지흠",
  "이창현", "김영은", "류경희", "최유빈", "이경수", "하지선", "정권택", "박민아", "이다솜", "노주연",
  "이재성", "조미경", "홍인선", "이소희", "김한비"
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
    .neq('name', 'impossible_name_value'); 
    
  if (error) {
    console.error('Error clearing data:', error);
  }
};
