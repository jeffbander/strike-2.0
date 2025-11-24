-- Strike Prep Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

---
--- CORE TABLES
---

-- 1. Health Systems
CREATE TABLE health_systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,

  CONSTRAINT health_systems_name_key UNIQUE (name)
);

CREATE INDEX idx_health_systems_active ON health_systems(is_active);

-- 2. Health System Admins
CREATE TABLE health_system_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  health_system_id UUID NOT NULL REFERENCES health_systems(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,

  CONSTRAINT health_system_admins_user_key UNIQUE (user_id),
  CONSTRAINT health_system_admins_email_key UNIQUE (email)
);

CREATE INDEX idx_hs_admins_system ON health_system_admins(health_system_id);
CREATE INDEX idx_hs_admins_user ON health_system_admins(user_id);

-- 3. Hospitals
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  health_system_id UUID REFERENCES health_systems(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  short_code VARCHAR(10) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_hospitals_system ON hospitals(health_system_id);
CREATE INDEX idx_hospitals_short_code ON hospitals(short_code);

-- 4. Hospital Admins
CREATE TABLE hospital_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  can_manage_multiple_hospitals BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,

  CONSTRAINT hospital_admins_user_key UNIQUE (user_id)
);

CREATE INDEX idx_hospital_admins_hospital ON hospital_admins(hospital_id);
CREATE INDEX idx_hospital_admins_user ON hospital_admins(user_id);

-- 5. Units/Floors
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  floor VARCHAR(20),
  bed_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,

  CONSTRAINT units_hospital_name_key UNIQUE (hospital_id, name)
);

CREATE INDEX idx_units_hospital ON units(hospital_id);

-- 6. Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT departments_hospital_name_key UNIQUE (hospital_id, name)
);

CREATE INDEX idx_departments_hospital ON departments(hospital_id);
CREATE INDEX idx_departments_active ON departments(is_active);

-- 7. Departmental Admins
CREATE TABLE departmental_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  can_add_other_admins BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,

  CONSTRAINT dept_admins_dept_user_key UNIQUE (department_id, user_id)
);

CREATE INDEX idx_dept_admins_dept ON departmental_admins(department_id);
CREATE INDEX idx_dept_admins_user ON departmental_admins(user_id);

-- 8. Job Types
CREATE TABLE job_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_job_types_hospital ON job_types(hospital_id);
CREATE INDEX idx_job_types_code ON job_types(code);

-- 9. Skills (Master List)
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  is_system_default BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,

  CONSTRAINT skills_name_key UNIQUE (name)
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_active ON skills(is_active);

-- 10. Department Skills
CREATE TABLE department_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by VARCHAR(255),

  CONSTRAINT dept_skills_dept_skill_key UNIQUE (department_id, skill_id)
);

CREATE INDEX idx_dept_skills_dept ON department_skills(department_id);
CREATE INDEX idx_dept_skills_skill ON department_skills(skill_id);

-- 11. Services
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,

  day_capacity INTEGER,
  night_capacity INTEGER,
  weekend_capacity INTEGER,

  operates_days BOOLEAN DEFAULT TRUE,
  operates_nights BOOLEAN DEFAULT FALSE,
  operates_weekends BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_modified_by VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,

  CONSTRAINT services_dept_name_key UNIQUE (department_id, name)
);

CREATE INDEX idx_services_dept ON services(department_id);
CREATE INDEX idx_services_hospital ON services(hospital_id);
CREATE INDEX idx_services_unit ON services(unit_id);

-- 12. Service Job Types
CREATE TABLE service_job_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  job_type_id UUID NOT NULL REFERENCES job_types(id) ON DELETE CASCADE,
  positions_per_shift INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT service_job_types_service_job_key UNIQUE (service_id, job_type_id)
);

CREATE INDEX idx_service_job_types_service ON service_job_types(service_id);
CREATE INDEX idx_service_job_types_job ON service_job_types(job_type_id);

-- 13. Service Job Type Skills
CREATE TABLE service_job_type_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_job_type_id UUID NOT NULL REFERENCES service_job_types(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT sjt_skills_sjt_skill_key UNIQUE (service_job_type_id, skill_id)
);

CREATE INDEX idx_sjt_skills_sjt ON service_job_type_skills(service_job_type_id);
CREATE INDEX idx_sjt_skills_skill ON service_job_type_skills(skill_id);

-- 14. Shifts
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  shift_type VARCHAR(50) NOT NULL,

  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  positions_needed INTEGER NOT NULL CHECK (positions_needed > 0),

  is_auto_generated BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),

  CONSTRAINT shifts_service_name_key UNIQUE (service_id, name)
);

CREATE INDEX idx_shifts_service ON shifts(service_id);
CREATE INDEX idx_shifts_type ON shifts(shift_type);

-- 15. Providers (create before job_positions for FK)
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,

  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),

  job_type_id UUID REFERENCES job_types(id) ON DELETE SET NULL,

  availability_comments TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_providers_dept ON providers(department_id);
CREATE INDEX idx_providers_hospital ON providers(hospital_id);
CREATE INDEX idx_providers_job_type ON providers(job_type_id);
CREATE INDEX idx_providers_email ON providers(email);

-- 16. Job Positions
CREATE TABLE job_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  service_job_type_id UUID NOT NULL REFERENCES service_job_types(id) ON DELETE CASCADE,

  job_code VARCHAR(100) NOT NULL UNIQUE,
  position_number INTEGER NOT NULL,

  status VARCHAR(20) DEFAULT 'Open',
  assigned_provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,
  assigned_by VARCHAR(255),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT job_positions_shift_number_key UNIQUE (shift_id, position_number)
);

CREATE INDEX idx_job_positions_shift ON job_positions(shift_id);
CREATE INDEX idx_job_positions_status ON job_positions(status);
CREATE INDEX idx_job_positions_assigned_provider ON job_positions(assigned_provider_id);
CREATE INDEX idx_job_positions_job_code ON job_positions(job_code);

-- 17. Provider Skills
CREATE TABLE provider_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT provider_skills_provider_skill_key UNIQUE (provider_id, skill_id)
);

CREATE INDEX idx_provider_skills_provider ON provider_skills(provider_id);
CREATE INDEX idx_provider_skills_skill ON provider_skills(skill_id);

-- 18. Provider Hospital Access
CREATE TABLE provider_hospital_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  can_work_here BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT provider_access_provider_hospital_key UNIQUE (provider_id, hospital_id)
);

CREATE INDEX idx_provider_access_provider ON provider_hospital_access(provider_id);
CREATE INDEX idx_provider_access_hospital ON provider_hospital_access(hospital_id);

-- 19. Assignments
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,

  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by VARCHAR(255),

  status VARCHAR(20) DEFAULT 'Pending',

  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_assignments_job_position ON assignments(job_position_id);
CREATE INDEX idx_assignments_provider ON assignments(provider_id);
CREATE INDEX idx_assignments_status ON assignments(status);

-- 20. Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  user_role VARCHAR(50),

  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,

  changes JSONB,

  ip_address INET,
  user_agent TEXT,

  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

---
--- SEED DATA
---

-- Insert Default Skills
INSERT INTO skills (name, category, description, is_system_default) VALUES
  ('BLS', 'Basic', 'Basic Life Support certification', TRUE),
  ('ACLS', 'Basic', 'Advanced Cardiovascular Life Support', TRUE),
  ('PALS', 'Basic', 'Pediatric Advanced Life Support', TRUE),
  ('Medicine Basics', 'Basic', 'Fundamental medical knowledge and patient care', TRUE),
  ('Surgical Basics', 'Basic', 'Basic surgical knowledge and techniques', TRUE),

  ('A-line placement', 'Procedural', 'Arterial line insertion', TRUE),
  ('Central line placement', 'Procedural', 'Central venous catheter insertion', TRUE),
  ('Foley catheter placement', 'Procedural', 'Urinary catheter insertion', TRUE),
  ('NG tube placement', 'Procedural', 'Nasogastric tube insertion', TRUE),
  ('Intubation', 'Procedural', 'Endotracheal intubation', TRUE),
  ('Arterial blood gas (ABG)', 'Procedural', 'ABG sample collection', TRUE),
  ('Lumbar puncture', 'Procedural', 'Spinal tap procedure', TRUE),
  ('Thoracentesis', 'Procedural', 'Pleural fluid drainage', TRUE),
  ('Paracentesis', 'Procedural', 'Peritoneal fluid drainage', TRUE),
  ('Chest tube placement', 'Procedural', 'Thoracostomy tube insertion', TRUE),

  ('Cardiology Specialty', 'Specialty', 'Advanced cardiology knowledge', TRUE),
  ('Neurology Specialty', 'Specialty', 'Neurological expertise', TRUE),
  ('ICU/Critical Care', 'Specialty', 'Intensive care knowledge', TRUE),
  ('Emergency Medicine', 'Specialty', 'Emergency care expertise', TRUE),
  ('Pediatrics', 'Specialty', 'Pediatric care knowledge', TRUE),
  ('OB/GYN', 'Specialty', 'Obstetrics and gynecology', TRUE),
  ('Oncology', 'Specialty', 'Cancer care knowledge', TRUE),
  ('Pulmonology', 'Specialty', 'Respiratory care expertise', TRUE),
  ('Gastroenterology', 'Specialty', 'GI care knowledge', TRUE),
  ('Nephrology', 'Specialty', 'Kidney care expertise', TRUE);

-- Insert Default Job Types (global, not hospital-specific)
INSERT INTO job_types (name, code, is_default, description) VALUES
  ('Registered Nurse', 'RN', TRUE, 'Licensed registered nurse'),
  ('Licensed Practical Nurse', 'LPN', TRUE, 'Licensed practical/vocational nurse'),
  ('Nurse Practitioner', 'NP', TRUE, 'Advanced practice registered nurse'),
  ('Physician Assistant', 'PA', TRUE, 'Physician assistant'),
  ('Medical Doctor', 'MD', TRUE, 'Licensed physician'),
  ('Doctor of Osteopathy', 'DO', TRUE, 'Osteopathic physician'),
  ('Resident', 'RES', TRUE, 'Medical resident in training'),
  ('Fellow', 'FEL', TRUE, 'Medical fellow in specialty training'),
  ('Certified Nursing Assistant', 'CNA', TRUE, 'Certified nursing assistant'),
  ('Medical Technician', 'MT', TRUE, 'Medical/lab technician');

---
--- FUNCTIONS & TRIGGERS
---

-- Function: Update last_modified_at timestamp
CREATE OR REPLACE FUNCTION update_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update last_modified_at on services
CREATE TRIGGER update_services_modified_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_at();

-- Trigger: Auto-update last_modified_at on providers
CREATE TRIGGER update_providers_modified_at
  BEFORE UPDATE ON providers
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_at();

-- Trigger: Auto-update modified_at on assignments
CREATE OR REPLACE FUNCTION update_assignments_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assignments_modified_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_assignments_modified_at();

---
--- ROW LEVEL SECURITY (Disabled for development - enable in production)
---

-- For development, we'll use the service role key which bypasses RLS
-- Enable RLS on tables when ready for production:
-- ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
-- etc.

---
--- DONE
---
