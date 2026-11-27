
export interface MetricCard {
  label: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string;
}

export interface InquiryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{ title: string; uri: string }>;
}

export interface ActivityItem {
  id: string;
  user: string;
  avatar: string;
  action: string;
  target: string;
  time: string;
  type: 'pr' | 'issue' | 'commit' | 'deploy';
}

export interface BlogPost {
  id: string;
  slug?: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  date: string;
  status: 'draft' | 'published' | 'synced';
  category: string;
  tags: string[];
  featured_image?: string;
}

export type SocialPlatform = 'instagram' | 'facebook';

export interface SocialPost {
  id: string;
  blogId?: string | null;
  blogSlug?: string;
  platform: SocialPlatform;
  title: string;
  excerpt?: string;
  caption: string;
  hashtags: string[];
  imageUrl?: string;
  articleUrl?: string;
  category?: string;
  authorName?: string;
  accountHandle?: string;
  status: 'draft' | 'queued' | 'published';
  dispatched?: boolean;
  deliveryChannel?: string;
  externalPostId?: string | null;
  externalUrl?: string | null;
  publishedAt?: string | null;
  queuedReason?: string | null;
  lastDispatchError?: string | null;
  customEdited?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectComment {
  id: string;
  user: string;
  avatar: string;
  text: string;
  timestamp: string;
  isSystemLog?: boolean;
}

export interface ProjectIssue {
  id: string;
  title: string;
  description?: string;
  assignee: string;
  status: 'Open' | 'In Progress' | 'Review' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  createdDate: string;
  comments?: ProjectComment[];
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  date: string;
  status: 'new' | 'replied' | 'archived';
  priority: 'High' | 'Medium' | 'Low';
}

export interface ProjectUpdateItem {
  id: string;
  title: string;
  summary: string;
  author: string;
  authorRole?: string;
  date?: string;
  timestamp?: string;
  progress?: number;
  progressAfter?: number;
}

export interface Project {
  id: string;
  name: string;
  clientName?: string;
  assignedDeveloper?: string;
  assignedViewer?: string;
  description: string;
  language: string;
  status: 'active' | 'archived' | 'maintenance' | 'completed';
  health: number; // 0-100
  progress: number; // 0-100
  lastUpdate: string;
  dueDate?: string;
  repoUrl?: string;
  updates?: ProjectUpdateItem[];
  comments?: ProjectComment[];
  issues?: ProjectIssue[];
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  assigneeAvatar?: string;
  status: 'todo' | 'in-progress' | 'completed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  dueDate: string;
  tags: string[];
  points?: number;
  projectId?: string;
  projectName?: string;
  subtasks?: SubTask[];
  comments?: ProjectComment[];
}

export type UserRole = 'Admin' | 'Developer' | 'Editor' | 'Viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'pending';
  avatar?: string;
  joinDate: string;
}

export enum DashboardTab {
  OVERVIEW = 'overview',
  PROJECTS = 'projects',
  INQUIRE = 'inquire',
  ANALYTICS = 'analytics',
  TASKS = 'tasks',
  TEAM = 'quotations',
  QUOTATIONS = 'quotations',
  BLOGS = 'blogs',
  USERS = 'users',
  CONTACTS = 'contacts'
}

export const ROLE_PERMISSIONS: Record<UserRole, DashboardTab[]> = {
  Admin: [
    DashboardTab.OVERVIEW,
    DashboardTab.PROJECTS,
    DashboardTab.INQUIRE,
    DashboardTab.BLOGS,
    DashboardTab.USERS,
    DashboardTab.TEAM,
    DashboardTab.CONTACTS
  ],
  Developer: [
    DashboardTab.OVERVIEW,
    DashboardTab.PROJECTS,
    DashboardTab.INQUIRE,
    DashboardTab.BLOGS,
    DashboardTab.TEAM,
    DashboardTab.CONTACTS
  ],
  Editor: [
    DashboardTab.OVERVIEW,
    DashboardTab.PROJECTS,
    DashboardTab.INQUIRE,
    DashboardTab.BLOGS
  ],
  Viewer: [
    DashboardTab.OVERVIEW,
    DashboardTab.PROJECTS
  ]
};

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'task' | 'contact';
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  timestamp: string;
}
