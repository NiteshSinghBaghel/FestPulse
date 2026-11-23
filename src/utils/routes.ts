import type { UserRole } from '../types';

export type LoggedOutView = 'landing' | 'login';

export type StudentTab = 'home' | 'my-tickets' | 'profile';
export type HostTab = 'host-dashboard' | 'host-events' | 'host-attendees' | 'host-analytics' | 'profile';
export type AppTab = StudentTab | HostTab;

export interface ParsedRoute {
  kind: 'landing' | 'login' | 'tab' | 'event';
  landingRole?: UserRole;
  tab?: AppTab;
  eventId?: string;
  attendeeEventId?: string;
  isUnauthorizedOrUnknown?: boolean;
}

const STUDENT_TABS: ReadonlyArray<StudentTab> = ['home', 'my-tickets', 'profile'];
const HOST_TABS: ReadonlyArray<HostTab> = ['host-dashboard', 'host-events', 'host-attendees', 'host-analytics', 'profile'];

export function isValidTabForRole(tab: string, role: UserRole): tab is AppTab {
  if (role === 'host') {
    return (HOST_TABS as ReadonlyArray<string>).includes(tab);
  }
  return (STUDENT_TABS as ReadonlyArray<string>).includes(tab);
}

export function getDefaultTabForRole(role: UserRole): AppTab {
  return role === 'host' ? 'host-dashboard' : 'home';
}

export function getPathForTab(tab: AppTab, attendeeEventId?: string): string {
  if (tab === 'host-attendees' && attendeeEventId) {
    return `/host-attendees?eventId=${encodeURIComponent(attendeeEventId)}`;
  }
  return `/${tab}`;
}

export function getPathForEvent(eventId: string): string {
  return `/events/${encodeURIComponent(eventId)}`;
}

export function getPathForLogin(role: UserRole): string {
  return role === 'host' ? '/host-login' : '/student-login';
}

export function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

/**
 * Resolves the requested URL pathname + search for either unauthenticated or authenticated users.
 * Enforces strict authentication and role route boundaries.
 */
export function resolveRoute(
  pathname: string,
  search: string,
  isAuthenticated: boolean,
  role: UserRole
): ParsedRoute {
  const path = normalizePathname(pathname);
  const params = new URLSearchParams(search || '');
  const mode = params.get('mode') || '';
  const hasResetParams =
    mode === 'resetPassword' || Boolean(params.get('resetToken') || params.get('oobCode'));

  // 1. Unauthenticated / Logged-out access guard:
  // Only landing ('/') and login routes ('/login', '/student-login', '/host-login') or password-reset links are permitted.
  if (!isAuthenticated) {
    if (path === '/host-login') {
      return { kind: 'login', landingRole: 'host' };
    }
    if (path === '/student-login') {
      return { kind: 'login', landingRole: 'user' };
    }
    if (path === '/login' || hasResetParams) {
      const targetRole = params.get('role') === 'host' ? 'host' : 'user';
      return { kind: 'login', landingRole: targetRole };
    }
    if (path === '/') {
      return { kind: 'landing' };
    }
    // Any attempt to open /home, /my-tickets, /profile, /events/:id, /host-* while logged out is blocked and redirected to landing
    return { kind: 'landing', isUnauthorizedOrUnknown: true };
  }

  // 2. Authenticated state: prevent staying on landing or login URLs
  if (path === '/' || path === '/login' || path === '/student-login' || path === '/host-login') {
    return {
      kind: 'tab',
      tab: getDefaultTabForRole(role),
      isUnauthorizedOrUnknown: path !== '/',
    };
  }

  // 3. Event detail route (/events/:eventId)
  if (path.startsWith('/events/')) {
    const eventId = decodeURIComponent(path.slice('/events/'.length).split('/')[0] || '').trim();
    if (eventId) {
      return { kind: 'event', eventId };
    }
    return {
      kind: 'tab',
      tab: getDefaultTabForRole(role),
      isUnauthorizedOrUnknown: true,
    };
  }

  // 4. Role-scoped tab routes
  const candidateTab = path.slice(1);
  if (isValidTabForRole(candidateTab, role)) {
    const attendeeEventId =
      candidateTab === 'host-attendees' ? (params.get('eventId') || '').trim() || undefined : undefined;
    return {
      kind: 'tab',
      tab: candidateTab,
      attendeeEventId,
    };
  }

  // Cross-role route (e.g. student accessing /host-dashboard or host accessing /my-tickets) or unknown 404 path
  return {
    kind: 'tab',
    tab: getDefaultTabForRole(role),
    isUnauthorizedOrUnknown: true,
  };
}
