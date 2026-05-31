export type House = {
  id: string;
  name: string;
};

export type Student = {
  id: string;
  student_id: string;
  full_name: string;
  house_id: string;
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
