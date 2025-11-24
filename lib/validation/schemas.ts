import { z } from 'zod';

// ============================================
// SANITIZATION HELPERS
// ============================================

/**
 * Remove XSS-dangerous characters from strings
 */
const xssSanitize = (str: string) => str.replace(/[<>"&]/g, '');

/**
 * Sanitize and trim string
 */
const sanitize = (str: string) => xssSanitize(str.trim());

// ============================================
// BASE SCHEMAS (Reusable)
// ============================================

/**
 * UUID schema - validates UUID format
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Safe text schema - basic sanitized text input
 */
export const safeTextSchema = z
  .string()
  .min(1, 'Required')
  .max(255, 'Too long')
  .transform(sanitize);

/**
 * Email schema - validates and normalizes email
 */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()
  .transform(sanitize);

/**
 * Phone schema - optional phone number
 */
export const phoneSchema = z
  .string()
  .regex(/^[\d\s\-+()]*$/, 'Invalid phone number')
  .max(50, 'Phone number too long')
  .optional()
  .transform((val) => (val ? sanitize(val) : undefined));

// ============================================
// HEALTHCARE-SPECIFIC SCHEMAS
// ============================================

/**
 * Provider name schema
 * Allows medical credentials like "MD", "PA-C", "NP", etc.
 */
export const providerNameSchema = z
  .string()
  .min(2, 'Name too short')
  .max(100, 'Name too long')
  .regex(/^[a-zA-Z\s\-'.,]+$/, 'Name contains invalid characters')
  .transform(sanitize);

/**
 * Hospital name schema
 */
export const hospitalNameSchema = z
  .string()
  .min(2, 'Hospital name too short')
  .max(255, 'Hospital name too long')
  .regex(/^[a-zA-Z0-9\s\-'.,&()]+$/, 'Hospital name contains invalid characters')
  .transform(sanitize);

/**
 * Hospital short code schema
 */
export const hospitalCodeSchema = z
  .string()
  .min(2, 'Code too short')
  .max(10, 'Code too long (max 10 characters)')
  .regex(/^[A-Z0-9]+$/, 'Code must be uppercase letters and numbers only')
  .transform((val) => val.toUpperCase());

/**
 * Department name schema
 */
export const departmentNameSchema = z
  .string()
  .min(2, 'Department name too short')
  .max(100, 'Department name too long')
  .regex(/^[a-zA-Z\s\-/&]+$/, 'Department name contains invalid characters')
  .transform(sanitize);

/**
 * Service name schema
 */
export const serviceNameSchema = z
  .string()
  .min(2, 'Service name too short')
  .max(255, 'Service name too long')
  .regex(/^[a-zA-Z0-9\s\-/&]+$/, 'Service name contains invalid characters')
  .transform(sanitize);

/**
 * Unit/Floor name schema
 */
export const unitNameSchema = z
  .string()
  .min(1, 'Unit name required')
  .max(100, 'Unit name too long')
  .regex(/^[a-zA-Z0-9\s\-/]+$/, 'Unit name contains invalid characters')
  .transform(sanitize);

/**
 * Job type code schema
 */
export const jobTypeCodeSchema = z
  .string()
  .min(1, 'Job type code required')
  .max(20, 'Job type code too long')
  .regex(/^[A-Z]+$/, 'Job type code must be uppercase letters only')
  .transform((val) => val.toUpperCase());

/**
 * Skill name schema
 */
export const skillNameSchema = z
  .string()
  .min(2, 'Skill name too short')
  .max(100, 'Skill name too long')
  .transform(sanitize);

// ============================================
// NUMERIC SCHEMAS
// ============================================

/**
 * Patient capacity schema
 */
export const capacitySchema = z
  .number()
  .int('Must be a whole number')
  .min(0, 'Cannot be negative')
  .max(1000, 'Capacity seems unrealistically high')
  .optional();

/**
 * Positions needed schema
 */
export const positionsNeededSchema = z
  .number()
  .int('Must be a whole number')
  .min(1, 'Must need at least 1 position')
  .max(100, 'Too many positions for a single shift');

/**
 * Time schema (HH:mm format)
 */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (use HH:mm)');

// ============================================
// ENUM SCHEMAS
// ============================================

export const skillCategorySchema = z.enum(['Basic', 'Procedural', 'Specialty']);

export const shiftTypeSchema = z.enum([
  'Weekday_AM',
  'Weekday_PM',
  'Weekend_AM',
  'Weekend_PM',
  'Custom',
]);

export const jobPositionStatusSchema = z.enum(['Open', 'Assigned', 'Confirmed']);

export const assignmentStatusSchema = z.enum(['Pending', 'Confirmed', 'Cancelled']);

export const auditActionSchema = z.enum(['CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'VIEW']);

export const userRoleSchema = z.enum([
  'super_admin',
  'health_system_admin',
  'hospital_admin',
  'departmental_admin',
]);

// ============================================
// COMPOSITE ENTITY SCHEMAS
// ============================================

/**
 * Health System creation schema
 */
export const createHealthSystemSchema = z.object({
  name: hospitalNameSchema,
});

/**
 * Hospital creation schema
 */
export const createHospitalSchema = z.object({
  health_system_id: uuidSchema,
  name: hospitalNameSchema,
  short_code: hospitalCodeSchema,
  address: safeTextSchema.optional(),
  city: safeTextSchema.optional(),
  state: safeTextSchema.optional(),
  zip_code: z.string().max(20).optional(),
});

/**
 * Department creation schema
 */
export const createDepartmentSchema = z.object({
  hospital_id: uuidSchema,
  name: departmentNameSchema,
  is_default: z.boolean().default(false),
});

/**
 * Unit creation schema
 */
export const createUnitSchema = z.object({
  hospital_id: uuidSchema,
  name: unitNameSchema,
  description: safeTextSchema.optional(),
  floor_number: z.string().max(20).optional(),
});

/**
 * Job Type creation schema
 */
export const createJobTypeSchema = z.object({
  hospital_id: uuidSchema,
  name: safeTextSchema,
  code: jobTypeCodeSchema,
  description: safeTextSchema.optional(),
});

/**
 * Provider creation schema
 */
export const createProviderSchema = z.object({
  department_id: uuidSchema,
  hospital_id: uuidSchema,
  name: providerNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  job_type_id: uuidSchema,
  skill_ids: z.array(uuidSchema).min(1, 'At least one skill required'),
  hospital_access_ids: z.array(uuidSchema).min(1, 'At least one hospital access required'),
  availability_comments: safeTextSchema.optional(),
});

/**
 * Service creation schema
 */
export const createServiceSchema = z.object({
  department_id: uuidSchema,
  hospital_id: uuidSchema,
  name: serviceNameSchema,
  unit_id: uuidSchema.optional(),
  day_capacity: capacitySchema,
  night_capacity: capacitySchema,
  weekend_capacity: capacitySchema,
  operates_days: z.boolean().default(true),
  operates_nights: z.boolean().default(false),
  operates_weekends: z.boolean().default(false),
});

/**
 * Shift creation schema
 */
export const createShiftSchema = z.object({
  service_id: uuidSchema,
  service_job_type_id: uuidSchema,
  name: safeTextSchema,
  shift_type: shiftTypeSchema,
  start_time: timeSchema,
  end_time: timeSchema,
  positions_needed: positionsNeededSchema,
  is_auto_generated: z.boolean().default(true),
});

/**
 * Assignment creation schema
 */
export const createAssignmentSchema = z.object({
  job_position_id: uuidSchema,
  provider_id: uuidSchema,
  notes: safeTextSchema.optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate job code from components
 * Format: [Dept][Hospital][Service][JobType][Shift]_[#]
 */
export function generateJobCode(
  department: string,
  hospital: string,
  service: string,
  jobType: string,
  shift: string,
  positionNumber: number
): string {
  // Clean all inputs - remove special characters
  const clean = (str: string) =>
    str.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);

  const parts = [
    clean(department),
    clean(hospital),
    clean(service),
    clean(jobType),
    clean(shift),
  ].join('');

  return `${parts}_${positionNumber}`;
}
