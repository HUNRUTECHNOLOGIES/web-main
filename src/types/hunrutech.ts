export type ProjectCategory = 'Software' | 'CLI & Automation' | 'Web Apps';

export interface ProjectItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: ProjectCategory;
  version: string;
  techStack: string[];
  repoUrl: string;
  demoUrl: string;
  cloneCommand: string;
  imageUrl: string;
  featured: boolean;
  visible: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type CollabType =
  | 'Open-Source Contribution'
  | 'Joint Venture'
  | 'Client Project'
  | 'Security Research';

export type CollabStatus = 'Pending' | 'In Review' | 'Approved' | 'Archived';

export interface CollaborationRecord {
  id: string;
  referenceId: string;
  name: string;
  portfolioUrl: string;
  contact: string;
  collabType: CollabType;
  techStack: string[];
  pitch: string;
  status: CollabStatus;
  adminNotes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CollabStatusRecord {
  referenceId: string;
  collabType: CollabType;
  status: CollabStatus;
  publicResponse: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type PresetCategory = 'Daraja' | 'Paystack' | 'Supabase' | 'Custom';

export interface ApiPreset {
  id: string;
  name: string;
  category: PresetCategory;
  method: HttpMethod;
  url: string;
  headersJson: string;
  bodyJson: string;
  description: string;
  enabled: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DevToolId =
  | 'api-tester'
  | 'smtp-tester'
  | 'jwt-decoder'
  | 'hash-base64'
  | 'json-formatter'
  | 'password-gen'
  | 'qr-scanner'
  | 'syntax-visualizer';

export interface SiteSettings {
  announcementText: string;
  announcementActive: boolean;
  maintenanceMode: boolean;
  proxyRateLimitPerMin: number;
  smtpRateLimitPerMin: number;
  enabledDevTools: DevToolId[];
  updatedAt?: unknown;
}
