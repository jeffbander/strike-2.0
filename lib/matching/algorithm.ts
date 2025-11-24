/**
 * Strike Prep - Matching Algorithm
 * Matches providers to job positions based on skills, hospital access, and availability
 */

import type { Provider, Skill, JobPosition } from '@/types/database';

export type MatchQuality = 'Perfect' | 'Good' | 'Partial' | 'NoMatch';

export interface MatchResult {
  provider: {
    id: string;
    name: string;
    email: string;
    job_type_name: string;
    job_type_code: string;
    home_department_name: string;
    home_hospital_name: string;
    skills: string[];
    can_work_at_hospitals: string[];
    availability_comments?: string;
  };
  matchQuality: MatchQuality;
  score: number;
  missingSkills: string[];
  extraSkills: string[];
  reasons: string[];
}

export interface JobRequirements {
  jobPositionId: string;
  jobCode: string;
  hospitalId: string;
  departmentId: string;
  requiredSkills: Array<{ id: string; name: string }>;
}

export interface ProviderData {
  id: string;
  name: string;
  email: string;
  job_type_name: string;
  job_type_code: string;
  home_department_id: string;
  home_department_name: string;
  home_hospital_id: string;
  home_hospital_name: string;
  skills: Array<{ id: string; name: string }>;
  can_work_at_hospital_ids: string[];
  can_work_at_hospitals: string[];
  has_current_assignment: boolean;
  availability_comments?: string;
}

/**
 * Find matching providers for a specific job position
 */
export function findMatchesForJob(
  job: JobRequirements,
  providers: ProviderData[]
): MatchResult[] {
  return providers
    .map((provider) => evaluateMatch(provider, job))
    .filter((result) => result.matchQuality !== 'NoMatch')
    .sort((a, b) => b.score - a.score);
}

/**
 * Evaluate how well a provider matches a job
 */
export function evaluateMatch(provider: ProviderData, job: JobRequirements): MatchResult {
  const result: MatchResult = {
    provider: {
      id: provider.id,
      name: provider.name,
      email: provider.email,
      job_type_name: provider.job_type_name,
      job_type_code: provider.job_type_code,
      home_department_name: provider.home_department_name,
      home_hospital_name: provider.home_hospital_name,
      skills: provider.skills.map((s) => s.name),
      can_work_at_hospitals: provider.can_work_at_hospitals,
      availability_comments: provider.availability_comments,
    },
    matchQuality: 'NoMatch',
    score: 0,
    missingSkills: [],
    extraSkills: [],
    reasons: [],
  };

  // Rule 1: Check if provider is already assigned
  if (provider.has_current_assignment) {
    result.reasons.push('Already assigned to another job');
    return result;
  }

  // Rule 2: Check hospital access
  if (!provider.can_work_at_hospital_ids.includes(job.hospitalId)) {
    result.reasons.push('Cannot work at this hospital');
    return result;
  }
  result.reasons.push('Has hospital access');

  // Rule 3: Check skills match
  const providerSkillIds = new Set(provider.skills.map((s) => s.id));
  const providerSkillNames = provider.skills.map((s) => s.name);

  const matchingSkills = job.requiredSkills.filter((req) => providerSkillIds.has(req.id));
  result.missingSkills = job.requiredSkills
    .filter((req) => !providerSkillIds.has(req.id))
    .map((s) => s.name);

  result.extraSkills = provider.skills
    .filter((prov) => !job.requiredSkills.some((req) => req.id === prov.id))
    .map((s) => s.name);

  // If missing any required skills, partial match
  if (result.missingSkills.length > 0) {
    result.matchQuality = 'Partial';
    result.reasons.push(`Missing skills: ${result.missingSkills.join(', ')}`);
    // Still calculate a partial score for ranking
    result.score = matchingSkills.length * 5;
    return result;
  }

  // All required skills matched
  result.reasons.push('Has all required skills');

  // Calculate score
  // +10 points per required skill matched
  result.score = matchingSkills.length * 10;

  // +5 if home department matches
  if (provider.home_department_id === job.departmentId) {
    result.score += 5;
    result.reasons.push('Home department match');
  }

  // +3 if home hospital matches
  if (provider.home_hospital_id === job.hospitalId) {
    result.score += 3;
    result.reasons.push('Home hospital match');
  }

  // -2 per extra skill (prefer exact match to avoid wasting overqualified providers)
  result.score -= result.extraSkills.length * 2;

  // Determine match quality
  if (result.extraSkills.length === 0) {
    result.matchQuality = 'Perfect';
    result.reasons.push('Exact skill match');
  } else {
    result.matchQuality = 'Good';
    result.reasons.push(`Has ${result.extraSkills.length} additional skill(s)`);
  }

  return result;
}

/**
 * Get match quality badge color for UI
 */
export function getMatchBadgeColor(quality: MatchQuality): string {
  switch (quality) {
    case 'Perfect':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Good':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Partial':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

/**
 * Get match quality icon
 */
export function getMatchIcon(quality: MatchQuality): string {
  switch (quality) {
    case 'Perfect':
      return '✅';
    case 'Good':
      return '⚠️';
    case 'Partial':
      return '🔶';
    default:
      return '❌';
  }
}
