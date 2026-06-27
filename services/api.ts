/**
 * Centralized API Service for DevInquire
 */

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export const api = {
    async fetch(endpoint: string, options: RequestInit = {}) {
        const token = localStorage.getItem('di_csrf_token');

        const defaultOptions: RequestInit = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': token || '',
                ...options.headers,
            }
        };

        const response = await fetch(`${API_BASE}${endpoint}`, defaultOptions);
        const result = await response.json();

        if (response.status === 401) {
            localStorage.removeItem('devinquire_user');
            localStorage.removeItem('di_csrf_token');
            window.location.reload();
        }

        if (!response.ok) {
            throw new Error(result.message || 'System fault.');
        }

        return result;
    },

    auth: {
        login: (credentials: any) => api.fetch('/auth/login.php', {
            method: 'POST',
            body: JSON.stringify(credentials)
        }),
        me: () => api.fetch('/auth/me.php'),
        logout: () => api.fetch('/auth/logout.php', { method: 'POST' })
    },

    dashboard: {
        getMetrics: () => api.fetch('/dashboard/metrics.php'),
        getActivity: () => api.fetch('/dashboard/activity.php')
    },

    projects: {
        list: () => api.fetch('/projects/list.php'),
        get: (id: string) => api.fetch(`/projects/detail.php?id=${id}`),
        create: (data: any) => api.fetch('/projects/create.php', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        update: (id: string, data: any) => api.fetch('/projects/update.php', {
            method: 'POST',
            body: JSON.stringify({ id, ...data })
        })
    },

    tasks: {
        list: () => api.fetch('/tasks/list.php'),
        create: (data: any) => api.fetch('/tasks/create.php', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        updateStatus: (id: string, status: string) => api.fetch('/tasks/update_status.php', {
            method: 'POST',
            body: JSON.stringify({ id, status })
        })
    },

    subtasks: {
        create: (taskId: string, title: string) => api.fetch('/tasks/subtasks/create.php', {
            method: 'POST',
            body: JSON.stringify({ taskId, title })
        }),
        toggle: (id: string, completed: boolean) => api.fetch('/tasks/subtasks/toggle.php', {
            method: 'POST',
            body: JSON.stringify({ id, completed: completed ? 1 : 0 })
        })
    },

    comments: {
        create: (taskId: string, text: string, isSystem: boolean = false) => api.fetch('/tasks/comments/create.php', {
            method: 'POST',
            body: JSON.stringify({ taskId, text, isSystem: isSystem ? 1 : 0 })
        })
    },

    blog: {
        list: () => api.fetch('/blog/list.php'),
        create: (data: any) => api.fetch('/blog/create.php', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        sync: (id: string) => api.fetch('/blog/sync.php', {
            method: 'POST',
            body: JSON.stringify({ id })
        })
    },

    users: {
        list: () => api.fetch('/users/list.php'),
        update: (data: any) => api.fetch('/users/update.php', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        delete: (id: string) => api.fetch('/users/delete.php', {
            method: 'POST',
            body: JSON.stringify({ id })
        })
    },

    contacts: {
        list: () => api.fetch('/contacts/list.php'),
        update: (data: any) => api.fetch('/contacts/update.php', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        delete: (id: string) => api.fetch('/contacts/delete.php', {
            method: 'POST',
            body: JSON.stringify({ id })
        })
    },

    analytics: {
        stats: () => api.fetch('/analytics/stats.php')
    },

    notifications: {
        list: () => api.fetch('/notifications/list.php'),
        markRead: (id: string) => api.fetch('/notifications/mark_read.php', {
            method: 'POST',
            body: JSON.stringify({ id })
        }),
        markAllRead: () => api.fetch('/notifications/mark_all_read.php', { method: 'POST' })
    }
};
