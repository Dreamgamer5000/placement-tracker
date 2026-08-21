import z from 'zod';

export const StudentSchema = z.object({
  id: z.number().optional(),
  regno: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  personal_email: z.string().optional(),
  gender: z.string().optional(),
  cgpa: z.number().optional(),
  tenth_marks: z.number().optional(),
  twelfth_marks: z.number().optional(),
  resume_link: z.string().optional(),
  branch: z.string(),
  campus: z.string(),
  neo_id: z.string().optional(),
  placed: z.boolean().default(false),
  masters: z.boolean().optional(),
  status: z.enum(['placed', 'intern', 'masters', 'not_placed']).default('not_placed'),
  topcoder: z.boolean().optional(),
  final_company_id: z.number().optional(),
  role: z.string().optional(),
  dob: z.string().optional()
});

export type Student = z.infer<typeof StudentSchema>;

export interface NeoIdRecord {
  id?: number;
  neo_id: string;
  campus: string;
  student_id?: number;
  regno?: string | null;
  topcoder?: boolean;
}

export interface Company {
  id?: number;
  name: string;
  notes?: string | null;
  rounds?: number | null;
  ctc?: string | null;
  total_rounds?: number | null;
  round_details?: string | null;
  experience_required?: string | null;
  role?: string | null;
  category?: string | null;
  stipend?: string | null;
  job_location?: string | null;
  eligible_branches?: string | null;
  eligibility_criteria?: string | null;
  website?: string | null;
}

export interface CompanyAnalytics {
  id?: number;
  company_id: number;
  // Shortlist analytics
  min_cgpa_shortlist?: number | null;
  avg_cgpa_shortlist?: number | null;
  min_tenth_shortlist?: number | null;
  avg_tenth_shortlist?: number | null;
  min_twelfth_shortlist?: number | null;
  avg_twelfth_shortlist?: number | null;
  total_shortlisted: number;
  male_count_shortlist: number;
  female_count_shortlist: number;
  gender_ratio_shortlist?: string | null;
  // Selection analytics
  min_cgpa_selected?: number | null;
  avg_cgpa_selected?: number | null;
  min_tenth_selected?: number | null;
  avg_tenth_selected?: number | null;
  min_twelfth_selected?: number | null;
  avg_twelfth_selected?: number | null;
  total_selected: number;
  male_count_selected: number;
  female_count_selected: number;
  gender_ratio_selected?: string | null;
  selection_ratio?: number | null;
}

export interface Shortlist {
  id?: number;
  student_id?: number;
  regno?: string | null;
  neo_id?: string | null;
  company_id: number;
  round_number: number;
  round_name: string;
  role?: string | null;
  shortlisted_at: string;
}

export interface Selection {
  id?: number;
  student_id?: number;
  regno?: string | null;
  neo_id?: string | null;
  company_id: number;
  role?: string | null;
  selected_at: string;
}

export interface RoleRecord {
  id?: number;
  name: string;
  category: string;
  created_at?: string;
}

export interface ShortlistRoundInfo {
  round_number: number;
  round_name: string;
  student_count: number;
  latest_shortlisted_at?: string;
}
