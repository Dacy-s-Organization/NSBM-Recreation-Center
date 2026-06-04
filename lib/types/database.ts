export type House = {
  id: string;
  name: string;
};

export type Student = {
  id: string;
  student_id: string | null;
  full_name: string;
  house_id: string | null;
  serial_no: number | null;
  faculty: string | null;
  intake: string | null;
  degree_programme: string | null;
  university: string | null;
  title: string | null;
  gender: string | null;
  nic: string | null;
  mobile: string | null;
  email: string | null;
  created_at: string;
  houses?: House | null;
};

export type SportTrack = {
  id: string;
  name: string;
  unit: string;
  lower_is_better: boolean;
};

export type SportRecord = {
  id: string;
  student_id: string;
  track_id: string;
  year: number;
  value: number;
  recorded_at: string;
  students?: Pick<Student, "student_id" | "full_name"> | null;
  sport_tracks?: SportTrack | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  updated_at: string;
};

export type SportsAchievementWinner = {
  student_id: string;
  students?: Pick<Student, "student_id" | "full_name"> | null;
};

export type SportsAchievement = {
  id: string;
  meet_year: number;
  sport: string;
  achievement_type: string;
  team_name: string | null;
  notes: string | null;
  created_at: string;
  sports_achievement_winners?: SportsAchievementWinner[];
};
