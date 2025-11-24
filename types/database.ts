// Strike Prep Capacity Management System - Database Types
// Generated from DATABASE_SCHEMA.md

export type UUID = string;
export type Timestamp = string;

// ============================================
// ENUMS
// ============================================

export type SkillCategory = 'Basic' | 'Procedural' | 'Specialty';

export type ShiftType =
  | 'Weekday_AM'
  | 'Weekday_PM'
  | 'Weekend_AM'
  | 'Weekend_PM'
  | 'Custom';

export type JobPositionStatus = 'Open' | 'Assigned' | 'Confirmed';

export type AssignmentStatus = 'Pending' | 'Confirmed' | 'Cancelled';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'VIEW';

export type UserRole =
  | 'super_admin'
  | 'health_system_admin'
  | 'hospital_admin'
  | 'departmental_admin';

// ============================================
// CORE ENTITIES
// ============================================

export interface HealthSystem {
  id: UUID;
  name: string;
  created_at: Timestamp;
  created_by: string; // Clerk Super Admin ID
  is_active: boolean;
}

export interface HealthSystemAdmin {
  id: UUID;
  health_system_id: UUID;
  user_id: string; // Clerk User ID
  email: string;
  name: string;
  created_at: Timestamp;
  is_active: boolean;
}

export interface Hospital {
  id: UUID;
  health_system_id: UUID;
  name: string;
  short_code: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  created_at: Timestamp;
  created_by: UUID;
  is_active: boolean;
}

export interface HospitalAdmin {
  id: UUID;
  hospital_id: UUID;
  user_id: string; // Clerk User ID
  email: string;
  name: string;
  can_manage_multiple_hospitals: boolean;
  created_at: Timestamp;
  is_active: boolean;
}

export interface Unit {
  id: UUID;
  hospital_id: UUID;
  name: string;
  description?: string;
  floor_number?: string;
  created_at: Timestamp;
  created_by: UUID;
  is_active: boolean;
}

export interface Department {
  id: UUID;
  hospital_id: UUID;
  name: string;
  is_default: boolean;
  is_active: boolean;
  created_at: Timestamp;
}

export interface DepartmentalAdmin {
  id: UUID;
  department_id: UUID;
  user_id: string; // Clerk User ID
  email: string;
  name: string;
  can_add_other_admins: boolean;
  created_at: Timestamp;
  assigned_by: string;
  is_active: boolean;
}

export interface JobType {
  id: UUID;
  hospital_id: UUID;
  name: string;
  code: string;
  is_default: boolean;
  description?: string;
  created_at: Timestamp;
  is_active: boolean;
}

export interface Skill {
  id: UUID;
  name: string;
  category: SkillCategory;
  description?: string;
  is_system_default: boolean;
  created_at: Timestamp;
  is_active: boolean;
}

export interface DepartmentSkill {
  id: UUID;
  department_id: UUID;
  skill_id: UUID;
  is_required: boolean;
  created_at: Timestamp;
  added_by: UUID;
}

export interface Service {
  id: UUID;
  department_id: UUID;
  hospital_id: UUID;
  name: string;
  unit_id?: UUID;
  day_capacity?: number;
  night_capacity?: number;
  weekend_capacity?: number;
  operates_days: boolean;
  operates_nights: boolean;
  operates_weekends: boolean;
  created_at: Timestamp;
  created_by: UUID;
  last_modified_at: Timestamp;
  last_modified_by?: UUID;
  is_active: boolean;
}

export interface ServiceJobType {
  id: UUID;
  service_id: UUID;
  job_type_id: UUID;
  created_at: Timestamp;
}

export interface ServiceJobTypeSkill {
  id: UUID;
  service_job_type_id: UUID;
  skill_id: UUID;
  is_required: boolean;
  created_at: Timestamp;
}

export interface Shift {
  id: UUID;
  service_id: UUID;
  service_job_type_id: UUID;
  name: string;
  shift_type: ShiftType;
  start_time: string; // TIME as string
  end_time: string;
  positions_needed: number;
  is_auto_generated: boolean;
  created_at: Timestamp;
  created_by: UUID;
}

export interface JobPosition {
  id: UUID;
  shift_id: UUID;
  service_job_type_id: UUID;
  job_code: string;
  position_number: number;
  status: JobPositionStatus;
  assigned_provider_id?: UUID;
  assigned_at?: Timestamp;
  assigned_by?: UUID;
  normal_staff_job_type_id?: UUID;
  strike_replacement_job_type_id?: UUID;
  created_at: Timestamp;
}

export interface Provider {
  id: UUID;
  department_id: UUID;
  hospital_id: UUID;
  name: string;
  email: string;
  phone?: string;
  job_type_id: UUID;
  availability_comments?: string;
  created_at: Timestamp;
  created_by: UUID;
  last_modified_at: Timestamp;
  is_active: boolean;
}

export interface ProviderSkill {
  id: UUID;
  provider_id: UUID;
  skill_id: UUID;
  created_at: Timestamp;
}

export interface ProviderHospitalAccess {
  id: UUID;
  provider_id: UUID;
  hospital_id: UUID;
  can_work_here: boolean;
  created_at: Timestamp;
}

export interface Assignment {
  id: UUID;
  job_position_id: UUID;
  provider_id: UUID;
  assigned_at: Timestamp;
  assigned_by: UUID;
  status: AssignmentStatus;
  notes?: string;
  created_at: Timestamp;
  modified_at: Timestamp;
}

export interface AuditLog {
  id: UUID;
  user_id: string;
  user_email?: string;
  user_role?: string;
  action: AuditAction;
  resource_type: string;
  resource_id?: UUID;
  changes?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  timestamp: Timestamp;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export type InvitableRole = 'health_system_admin' | 'hospital_admin' | 'departmental_admin';

export interface UserInvitation {
  id: UUID;
  email: string;
  name?: string;
  role: InvitableRole;
  health_system_id?: UUID;
  hospital_id?: UUID;
  department_id?: UUID;
  token: string;
  status: InvitationStatus;
  created_at: Timestamp;
  expires_at: Timestamp;
  accepted_at?: Timestamp;
  invited_by: string;
  invited_by_role: string;
  accepted_user_id?: string;
}

export interface SuperAdmin {
  id: UUID;
  user_id: string;
  email: string;
  name: string;
  created_at: Timestamp;
  is_active: boolean;
}

// ============================================
// VIEW TYPES (Joined data)
// ============================================

export interface JobPositionDetail {
  id: UUID;
  job_code: string;
  position_number: number;
  status: JobPositionStatus;
  service_name: string;
  service_id: UUID;
  department_name: string;
  department_id: UUID;
  hospital_name: string;
  hospital_code: string;
  hospital_id: UUID;
  shift_name: string;
  shift_type: ShiftType;
  start_time: string;
  end_time: string;
  job_type_name: string;
  job_type_code: string;
  required_skills: string[];
  assigned_provider_id?: UUID;
  assigned_provider_name?: string;
  assigned_at?: Timestamp;
}

export interface ProviderDetail {
  id: UUID;
  name: string;
  email: string;
  phone?: string;
  job_type_name: string;
  job_type_code: string;
  home_department_name: string;
  home_department_id: UUID;
  home_hospital_name: string;
  home_hospital_code: string;
  home_hospital_id: UUID;
  skills: string[];
  can_work_at_hospitals: string[];
  current_assignment_job_id?: UUID;
  current_assignment_job_code?: string;
  availability_comments?: string;
  is_active: boolean;
}

// ============================================
// SUPABASE DATABASE TYPE
// ============================================

export interface Database {
  public: {
    Tables: {
      health_systems: {
        Row: HealthSystem;
        Insert: Omit<HealthSystem, 'id' | 'created_at'>;
        Update: Partial<Omit<HealthSystem, 'id' | 'created_at'>>;
      };
      health_system_admins: {
        Row: HealthSystemAdmin;
        Insert: Omit<HealthSystemAdmin, 'id' | 'created_at'>;
        Update: Partial<Omit<HealthSystemAdmin, 'id' | 'created_at'>>;
      };
      hospitals: {
        Row: Hospital;
        Insert: Omit<Hospital, 'id' | 'created_at'>;
        Update: Partial<Omit<Hospital, 'id' | 'created_at'>>;
      };
      hospital_admins: {
        Row: HospitalAdmin;
        Insert: Omit<HospitalAdmin, 'id' | 'created_at'>;
        Update: Partial<Omit<HospitalAdmin, 'id' | 'created_at'>>;
      };
      units: {
        Row: Unit;
        Insert: Omit<Unit, 'id' | 'created_at'>;
        Update: Partial<Omit<Unit, 'id' | 'created_at'>>;
      };
      departments: {
        Row: Department;
        Insert: Omit<Department, 'id' | 'created_at'>;
        Update: Partial<Omit<Department, 'id' | 'created_at'>>;
      };
      departmental_admins: {
        Row: DepartmentalAdmin;
        Insert: Omit<DepartmentalAdmin, 'id' | 'created_at'>;
        Update: Partial<Omit<DepartmentalAdmin, 'id' | 'created_at'>>;
      };
      job_types: {
        Row: JobType;
        Insert: Omit<JobType, 'id' | 'created_at'>;
        Update: Partial<Omit<JobType, 'id' | 'created_at'>>;
      };
      skills: {
        Row: Skill;
        Insert: Omit<Skill, 'id' | 'created_at'>;
        Update: Partial<Omit<Skill, 'id' | 'created_at'>>;
      };
      department_skills: {
        Row: DepartmentSkill;
        Insert: Omit<DepartmentSkill, 'id' | 'created_at'>;
        Update: Partial<Omit<DepartmentSkill, 'id' | 'created_at'>>;
      };
      services: {
        Row: Service;
        Insert: Omit<Service, 'id' | 'created_at' | 'last_modified_at'>;
        Update: Partial<Omit<Service, 'id' | 'created_at'>>;
      };
      service_job_types: {
        Row: ServiceJobType;
        Insert: Omit<ServiceJobType, 'id' | 'created_at'>;
        Update: Partial<Omit<ServiceJobType, 'id' | 'created_at'>>;
      };
      service_job_type_skills: {
        Row: ServiceJobTypeSkill;
        Insert: Omit<ServiceJobTypeSkill, 'id' | 'created_at'>;
        Update: Partial<Omit<ServiceJobTypeSkill, 'id' | 'created_at'>>;
      };
      shifts: {
        Row: Shift;
        Insert: Omit<Shift, 'id' | 'created_at'>;
        Update: Partial<Omit<Shift, 'id' | 'created_at'>>;
      };
      job_positions: {
        Row: JobPosition;
        Insert: Omit<JobPosition, 'id' | 'created_at'>;
        Update: Partial<Omit<JobPosition, 'id' | 'created_at'>>;
      };
      providers: {
        Row: Provider;
        Insert: Omit<Provider, 'id' | 'created_at' | 'last_modified_at'>;
        Update: Partial<Omit<Provider, 'id' | 'created_at'>>;
      };
      provider_skills: {
        Row: ProviderSkill;
        Insert: Omit<ProviderSkill, 'id' | 'created_at'>;
        Update: Partial<Omit<ProviderSkill, 'id' | 'created_at'>>;
      };
      provider_hospital_access: {
        Row: ProviderHospitalAccess;
        Insert: Omit<ProviderHospitalAccess, 'id' | 'created_at'>;
        Update: Partial<Omit<ProviderHospitalAccess, 'id' | 'created_at'>>;
      };
      assignments: {
        Row: Assignment;
        Insert: Omit<Assignment, 'id' | 'created_at' | 'modified_at' | 'assigned_at'>;
        Update: Partial<Omit<Assignment, 'id' | 'created_at'>>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id'>;
        Update: never;
      };
      user_invitations: {
        Row: UserInvitation;
        Insert: Omit<UserInvitation, 'id' | 'created_at' | 'expires_at' | 'status'> & { status?: InvitationStatus };
        Update: Partial<Pick<UserInvitation, 'status' | 'accepted_at' | 'accepted_user_id'>>;
      };
      super_admins: {
        Row: SuperAdmin;
        Insert: Omit<SuperAdmin, 'id' | 'created_at'>;
        Update: Partial<Pick<SuperAdmin, 'name' | 'is_active'>>;
      };
    };
    Views: {
      job_positions_detail: {
        Row: JobPositionDetail;
      };
      providers_detail: {
        Row: ProviderDetail;
      };
    };
  };
}

// ============================================
// DEFAULT DATA CONSTANTS
// ============================================

export const DEFAULT_DEPARTMENTS = [
  'Cardiology',
  'Neurosurgery',
  'Orthopedics',
  'General Surgery',
  'Emergency Medicine',
  'Internal Medicine',
  'ICU / Critical Care',
  'Pediatrics',
  'OB/GYN',
  'Psychiatry',
  'Radiology',
  'Anesthesiology',
  'Oncology',
  'Urology',
  'Dermatology',
  'Pulmonology',
  'Gastroenterology',
  'Nephrology',
  'Endocrinology',
  'Rheumatology',
] as const;

export const DEFAULT_JOB_TYPES = [
  { name: 'Medical Doctor', code: 'MD' },
  { name: 'Nurse Practitioner', code: 'NP' },
  { name: 'Physician Assistant', code: 'PA' },
  { name: 'Registered Nurse', code: 'RN' },
  { name: 'Fellow', code: 'FELLOW' },
  { name: 'Resident', code: 'RESIDENT' },
] as const;

export const DEFAULT_SKILLS = {
  Basic: ['Medicine Basics', 'Surgical Basics'],
  Procedural: [
    'A-line placement',
    'Central line placement',
    'Foley catheter placement',
    'NG tube placement',
    'Intubation',
    'Arterial blood gas (ABG)',
    'Lumbar puncture',
    'Thoracentesis',
    'Paracentesis',
    'Chest tube placement',
  ],
  Specialty: [
    'Cardiology Specialty',
    'Neurosurgery Specialty',
    'Orthopedic Specialty',
    'General Surgery Specialty',
    'ICU/Critical Care Specialty',
    'Emergency Medicine Specialty',
    'Pediatrics Specialty',
    'OB/GYN Specialty',
    'Urology Specialty',
    'Dermatology Specialty',
    'Psychiatry Specialty',
    'Radiology Specialty',
    'Anesthesiology Specialty',
    'Oncology Specialty',
    'Pulmonology Specialty',
    'Gastroenterology Specialty',
    'Nephrology Specialty',
    'Endocrinology Specialty',
    'Rheumatology Specialty',
    'Infectious Disease Specialty',
  ],
} as const;
