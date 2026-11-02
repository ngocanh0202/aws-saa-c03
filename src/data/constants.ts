import type { Domain } from './types';

export const TOTAL_QUESTIONS = 500;
export const SET_COUNT = 7;
export const SET_SIZE = 65;

export const DOMAINS: Domain[] = [1, 2, 3, 4];

export const DOMAIN_QUOTA: Record<Domain, number> = { 1: 20, 2: 17, 3: 15, 4: 13 };

export const DOMAIN_NAMES: Record<Domain, string> = {
  1: 'Design Secure Architectures',
  2: 'Design Resilient Architectures',
  3: 'Design High-Performing Architectures',
  4: 'Design Cost-Optimized Architectures',
};

export const DOMAIN_SHORT: Record<Domain, string> = {
  1: 'Secure',
  2: 'Resilient',
  3: 'High-Performing',
  4: 'Cost-Optimized',
};

// Danh mục "In-Scope AWS Services" trong Exam Guide SAA-C03.
export const SERVICE_CATEGORIES = [
  'Analytics',
  'Application Integration',
  'AWS Cost Management',
  'Compute',
  'Containers',
  'Database',
  'Developer Tools',
  'Front-End Web and Mobile',
  'Machine Learning',
  'Management and Governance',
  'Media Services',
  'Migration and Transfer',
  'Networking and Content Delivery',
  'Security, Identity, and Compliance',
  'Serverless',
  'Storage',
] as const;

export function byDomainRecord<T>(fn: (d: Domain) => T): Record<Domain, T> {
  return { 1: fn(1), 2: fn(2), 3: fn(3), 4: fn(4) };
}
