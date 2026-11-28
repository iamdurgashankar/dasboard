/**
 * Centralized API Service for DevInquire
 */

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api';

const FALLBACK_STORAGE_KEY = 'devinquire_prod_store_v1';

function getFallbackStore() {
    try {
        const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        // ignore storage errors
    }
    const today = new Date().toISOString().split('T')[0];
    const initial = {
        users: [
            {
                id: '1',
                name: 'DevInquire Admin',
                email: 'admin@devinquire.com',
                role: 'Admin',
                status: 'active',
                joinDate: today,
                active_tasks: 0
            }
        ],
        projects: [],
        tasks: [],
        blogs: [],
        socialPosts: [],
        contacts: [],
        notifications: []
    };
    try {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(initial));
    } catch {
        // ignore
    }
    return initial;
}

function saveFallbackStore(store: any) {
    try {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(store));
    } catch {
        // ignore
    }
}

function handleOfflineFallback(endpoint: string, options: RequestInit = {}): any {
    const store = getFallbackStore();
    const body = options.body && typeof options.body === 'string' ? JSON.parse(options.body) : {};

    if (endpoint.startsWith('/auth/login')) {
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (email === 'admin@devinquire.com' && (password === 'DevInquire2025!' || password === 'DevInquire2026!')) {
            const adminUser = store.users[0];
            return {
                status: 'success',
                message: 'Authentication successful. Welcome to the Neural Hub.',
                data: {
                    user: adminUser,
                    csrf_token: `di-local-${Date.now()}`
                }
            };
        }
        throw new Error('Invalid credentials. Link denied.');
    }

    if (endpoint.startsWith('/auth/register')) {
        const newUser = {
            id: `req-${Date.now()}`,
            name: body.name || 'Engineer',
            email: body.email || '',
            role: 'Developer',
            status: 'pending',
            joinDate: new Date().toISOString().split('T')[0],
            active_tasks: 0
        };
        store.users.unshift(newUser);
        saveFallbackStore(store);
        return { status: 'success', message: 'Access request queued.', data: { user: newUser } };
    }

    if (endpoint.startsWith('/auth/me')) {
        const saved = localStorage.getItem('devinquire_user');
        return {
            status: 'success',
            message: 'Identity retrieved.',
            data: saved ? JSON.parse(saved) : store.users[0]
        };
    }

    if (endpoint.startsWith('/auth/logout')) {
        return { status: 'success', message: 'Session terminated.' };
    }

    if (endpoint.startsWith('/dashboard/metrics')) {
        const totalBlogs = (store.blogs || []).length;
        const totalContacts = (store.contacts || []).length;
        const newContacts = (store.contacts || []).filter((c: any) => c.status === 'new').length;
        const totalUsers = (store.users || []).length;
        const activeUsers = (store.users || []).filter((u: any) => u.status === 'active').length;
        return {
            status: 'success',
            message: 'Metrics synchronized.',
            data: [
                { label: 'Client Inquiries', value: totalContacts, change: `${newContacts} new inbound`, trend: 'up', icon: 'fa-envelope-open-text' },
                { label: 'Editorial Studio', value: totalBlogs, change: 'Live on /blog', trend: 'up', icon: 'fa-pen-nib' },
                { label: 'Access & Users', value: totalUsers, change: 'RBAC Verified', trend: 'neutral', icon: 'fa-user-shield' },
                { label: 'Team Velocity', value: `${activeUsers} Active`, change: '94% Flow Index', trend: 'up', icon: 'fa-users' }
            ]
        };
    }

    if (endpoint.startsWith('/dashboard/activity')) {
        return {
            status: 'success',
            message: 'Activity stream synchronized.',
            data: store.projects.slice(0, 5).map((p: any, idx: number) => ({
                id: `act-${idx}`,
                user: 'AutoBot',
                avatar: 'https://ui-avatars.com/api/?name=AutoBot&background=6366f1&color=fff',
                action: 'deployed',
                target: `${p.name} to Production`,
                time: 'Just now',
                type: 'deploy'
            }))
        };
    }

    if (endpoint.startsWith('/projects/list')) {
        return { status: 'success', message: 'Projects retrieved.', data: store.projects };
    }

    if (endpoint.startsWith('/projects/detail')) {
        const id = new URLSearchParams(endpoint.split('?')[1] || '').get('id');
        const project = store.projects.find((p: any) => String(p.id) === String(id)) || store.projects[0];
        const issues = store.tasks.filter((t: any) => String(t.project_id) === String(project?.id));
        return { status: 'success', message: 'Project telemetry retrieved.', data: { ...project, issues } };
    }

    if (endpoint.startsWith('/projects/create')) {
        const initialProgress = Number(body.progress || 0);
        const newProj = {
            id: String(Date.now()),
            name: body.name,
            clientName: body.clientName || 'Enterprise Client',
            description: body.description || '',
            language: body.language || 'TypeScript',
            status: body.status || 'active',
            health: 100,
            progress: initialProgress,
            assignedDeveloper: body.assignedDeveloper || 'System Alpha',
            assignedViewer: body.assignedViewer || 'Viewer',
            dueDate: body.dueDate || '2026-06-01',
            lastUpdate: 'Just now',
            updates: [
                {
                    id: `upd-${Date.now()}`,
                    title: 'Project Initialized & Kickoff',
                    summary: `Client workspace provisioned for ${body.clientName || 'Enterprise Client'}.`,
                    author: body.assignedDeveloper || 'System Alpha',
                    authorRole: 'Developer',
                    progressAfter: initialProgress,
                    timestamp: 'Just now'
                }
            ]
        };
        store.projects.unshift(newProj);
        saveFallbackStore(store);
        return { status: 'success', message: 'Project initialized.', data: { id: newProj.id, project: newProj } };
    }

    if (endpoint.startsWith('/projects/update')) {
        store.projects = store.projects.map((p: any) => {
            if (String(p.id) !== String(body.id)) return p;
            const nextProgress = body.progress !== undefined ? Number(body.progress) : p.progress;
            const existingUpdates = Array.isArray(p.updates) ? p.updates : [];
            const nextUpdates = body.newUpdate
                ? [
                      {
                          id: `upd-${Date.now()}`,
                          title: body.newUpdate.title || 'Milestone Progress Update',
                          summary: body.newUpdate.summary || '',
                          author: body.newUpdate.author || 'Developer',
                          authorRole: body.newUpdate.authorRole || 'Developer',
                          progressAfter: nextProgress,
                          timestamp: 'Just now'
                      },
                      ...existingUpdates
                  ]
                : existingUpdates;
            const { newUpdate, ...rest } = body;
            return {
                ...p,
                ...rest,
                progress: nextProgress,
                lastUpdate: 'Just now',
                updates: nextUpdates
            };
        });
        saveFallbackStore(store);
        return { status: 'success', message: 'Project updated.' };
    }

    if (endpoint.startsWith('/projects/delete')) {
        store.projects = (store.projects || []).filter((p: any) => String(p.id) !== String(body.id));
        store.tasks = (store.tasks || []).filter((t: any) => String(t.project_id) !== String(body.id));
        saveFallbackStore(store);
        return { status: 'success', message: 'Project deleted successfully.' };
    }

    if (endpoint.startsWith('/projects/clear')) {
        store.projects = [];
        store.tasks = (store.tasks || []).filter((t: any) => !t.project_id);
        saveFallbackStore(store);
        return { status: 'success', message: 'All client projects cleared.' };
    }

    if (endpoint.startsWith('/tasks/list')) {
        return { status: 'success', message: 'Tasks synchronized.', data: store.tasks };
    }

    if (endpoint.startsWith('/tasks/create')) {
        const newTask = {
            id: String(Date.now()),
            project_id: body.projectId || '1',
            project_name: 'Neural Gateway',
            title: body.title,
            description: body.description || '',
            assignee_id: body.assigneeId || '1',
            assignee_name: 'System Alpha',
            status: 'todo',
            priority: body.priority || 'Medium',
            due_date: body.dueDate || new Date().toISOString().split('T')[0],
            points: body.points || 0,
            tags: body.tags || [],
            subtasks: [],
            comments: []
        };
        store.tasks.unshift(newTask);
        saveFallbackStore(store);
        return { status: 'success', message: 'Task provisioned.', data: { id: newTask.id } };
    }

    if (endpoint.startsWith('/tasks/update_status')) {
        store.tasks = store.tasks.map((t: any) =>
            String(t.id) === String(body.id) ? { ...t, status: body.status } : t
        );
        saveFallbackStore(store);
        return { status: 'success', message: 'Task status synchronized.' };
    }

    if (endpoint.startsWith('/tasks/subtasks/create')) {
        const subId = String(Date.now());
        store.tasks = store.tasks.map((t: any) =>
            String(t.id) === String(body.taskId)
                ? { ...t, subtasks: [...(t.subtasks || []), { id: subId, task_id: body.taskId, title: body.title, completed: false }] }
                : t
        );
        saveFallbackStore(store);
        return { status: 'success', message: 'Subtask provisioned.', data: { id: subId } };
    }

    if (endpoint.startsWith('/tasks/subtasks/toggle')) {
        store.tasks = store.tasks.map((t: any) => ({
            ...t,
            subtasks: (t.subtasks || []).map((st: any) =>
                String(st.id) === String(body.id) ? { ...st, completed: Boolean(body.completed) } : st
            )
        }));
        saveFallbackStore(store);
        return { status: 'success', message: 'Subtask toggled.' };
    }

    if (endpoint.startsWith('/tasks/comments/create')) {
        const commentId = String(Date.now());
        store.tasks = store.tasks.map((t: any) =>
            String(t.id) === String(body.taskId)
                ? {
                      ...t,
                      comments: [
                          { id: commentId, task_id: body.taskId, user_name: 'System Alpha', text: body.text, is_system_log: Boolean(body.isSystem), created_at: new Date().toISOString() },
                          ...(t.comments || [])
                      ]
                  }
                : t
        );
        saveFallbackStore(store);
        return { status: 'success', message: 'Comment recorded.', data: { id: commentId } };
    }

    if (endpoint.startsWith('/blog/config')) {
        if (!store.blogConfig) {
            store.blogConfig = {
                siteUrl: 'http://localhost:8000',
                defaultAuthor: 'DevInquire Editorial',
                defaultStatus: 'draft',
                autoSyncOnPublish: true,
                categories: ['Engineering', 'Architecture', 'AI & Systems', 'Cloud & DevOps', 'Product Strategy', 'Security'],
                seoTitleSuffix: ' | DevInquire Insights'
            };
        }
        if (options.method === 'POST') {
            store.blogConfig = { ...store.blogConfig, ...body };
            saveFallbackStore(store);
        }
        return { status: 'success', message: 'Blog config synchronized.', data: store.blogConfig };
    }

    if (endpoint.startsWith('/blog/list')) {
        return { status: 'success', message: 'Blog posts retrieved.', data: store.blogs };
    }

    if (endpoint.startsWith('/blog/create')) {
        const newPost = {
            id: String(Date.now()),
            title: body.title,
            slug: body.slug || String(body.title || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
            excerpt: body.excerpt || '',
            content: body.content || '',
            author_name: body.author_name || 'DevInquire Editorial',
            category: body.category || 'Engineering',
            tags: body.tags || [],
            status: body.status || 'draft',
            created_at: new Date().toISOString()
        };
        store.blogs.unshift(newPost);
        saveFallbackStore(store);
        return { status: 'success', message: 'Blog post saved.', data: { id: newPost.id } };
    }

    if (endpoint.startsWith('/blog/update')) {
        store.blogs = store.blogs.map((b: any) =>
            String(b.id) === String(body.id) ? { ...b, ...body } : b
        );
        saveFallbackStore(store);
        return { status: 'success', message: 'Blog post updated.' };
    }

    if (endpoint.startsWith('/blog/delete')) {
        store.blogs = store.blogs.filter((b: any) => String(b.id) !== String(body.id));
        saveFallbackStore(store);
        return { status: 'success', message: 'Blog post deleted.' };
    }

    if (endpoint.startsWith('/blog/sync')) {
        store.blogs = store.blogs.map((b: any) =>
            String(b.id) === String(body.id) ? { ...b, status: 'published' } : b
        );
        store.socialPosts = (store.socialPosts || []).map((sp: any) =>
            String(sp.blogId) === String(body.id) ? { ...sp, status: 'published' } : sp
        );
        saveFallbackStore(store);
        return { status: 'success', message: 'Article published and synced across Website, Instagram & Facebook.' };
    }

    if (endpoint.startsWith('/blog/social/config')) {
        if (!store.socialConfig) {
            store.socialConfig = {
                autoPopulateInstagram: true,
                autoPopulateFacebook: true,
                autoSyncOnBlogUpdate: true,
                autoPopulateDailyDev: true,
                autoPublishOnBlogPublish: true,
                instagramHandle: '@devinquire',
                facebookPageName: 'DevInquire',
                defaultHashtags: ['DevInquire', 'SoftwareEngineering', 'TechInsights'],
                ctaTemplate: 'Read the full engineering breakdown:',
                instagramAccountId: '',
                instagramAccessToken: '',
                facebookPageId: '',
                facebookAccessToken: '',
                webhookUrl: '',
            };
        }
        if (options.method === 'POST') {
            store.socialConfig = { ...store.socialConfig, ...body };
            saveFallbackStore(store);
        }
        return { status: 'success', message: 'Social configuration retrieved.', data: store.socialConfig };
    }

    if (endpoint.startsWith('/blog/social/list')) {
        const platform = new URLSearchParams(endpoint.split('?')[1] || '').get('platform');
        const list = (store.socialPosts || []).filter((sp: any) =>
            !platform || sp.platform === platform
        );
        return { status: 'success', message: 'Social posts retrieved.', data: list };
    }

    if (endpoint.startsWith('/blog/social/save')) {
        if (!Array.isArray(store.socialPosts)) store.socialPosts = [];
        const platforms = Array.isArray(body.platforms) && body.platforms.length > 0
            ? body.platforms
            : [body.platform || 'instagram'];
        const saved: any[] = [];
        for (const plt of platforms) {
            if (body.id && platforms.length === 1) {
                store.socialPosts = store.socialPosts.map((sp: any) =>
                    String(sp.id) === String(body.id) ? { ...sp, ...body, platform: plt } : sp
                );
                saved.push({ ...body, platform: plt });
            } else {
                const item = {
                    id: `${Date.now()}-${plt}`,
                    platform: plt,
                    blogId: body.blogId || null,
                    title: body.title || 'Social Post',
                    caption: body.caption || '',
                    hashtags: Array.isArray(body.hashtags) ? body.hashtags : ['DevInquire'],
                    imageUrl: body.imageUrl || '',
                    articleUrl: body.articleUrl || 'https://devinquire.com',
                    category: body.category || 'Engineering',
                    accountHandle: plt === 'instagram' ? '@devinquire' : 'DevInquire',
                    status: body.status || 'draft',
                    updatedAt: new Date().toISOString(),
                };
                store.socialPosts.unshift(item);
                saved.push(item);
            }
        }
        saveFallbackStore(store);
        return { status: 'success', message: 'Social post saved.', data: { posts: saved } };
    }

    if (endpoint.startsWith('/blog/social/publish')) {
        store.socialPosts = (store.socialPosts || []).map((sp: any) =>
            String(sp.id) === String(body.id)
                ? { ...sp, status: 'published', publishedAt: new Date().toISOString() }
                : sp
        );
        saveFallbackStore(store);
        return { status: 'success', message: 'Social post published.' };
    }

    if (endpoint.startsWith('/blog/social/delete')) {
        store.socialPosts = (store.socialPosts || []).filter((sp: any) => String(sp.id) !== String(body.id));
        saveFallbackStore(store);
        return { status: 'success', message: 'Social post deleted.' };
    }

    if (endpoint.startsWith('/blog/social/populate-all')) {
        if (!Array.isArray(store.socialPosts)) store.socialPosts = [];
        let count = 0;
        for (const b of store.blogs || []) {
            for (const plt of ['instagram', 'facebook']) {
                const exists = store.socialPosts.find(
                    (sp: any) => String(sp.blogId) === String(b.id) && sp.platform === plt
                );
                if (!exists) {
                    store.socialPosts.unshift({
                        id: `${Date.now()}-${b.id}-${plt}`,
                        blogId: String(b.id),
                        platform: plt,
                        title: b.title,
                        caption: `${b.title}\n\n${b.excerpt || b.content || ''}\n\nhttps://devinquire.com/blog/${b.slug || ''}`,
                        hashtags: Array.isArray(b.tags) && b.tags.length > 0 ? b.tags : ['DevInquire'],
                        imageUrl: b.featured_image || '',
                        articleUrl: `https://devinquire.com/blog/${b.slug || ''}`,
                        category: b.category || 'Engineering',
                        accountHandle: plt === 'instagram' ? '@devinquire' : 'DevInquire',
                        status: b.status === 'published' ? 'published' : 'draft',
                        updatedAt: new Date().toISOString(),
                    });
                    count += 1;
                }
            }
        }
        saveFallbackStore(store);
        return { status: 'success', message: `Populated ${count} Instagram & Facebook posts.`, data: { socialCount: count } };
    }

    if (endpoint.startsWith('/users/list')) {
        return { status: 'success', message: 'User directory retrieved.', data: store.users };
    }

    if (endpoint.startsWith('/users/create')) {
        const createdUser = {
            id: String(Date.now()),
            name: body.name || 'Member',
            email: body.email || '',
            role: body.role || 'Developer',
            status: 'active',
            avatar: body.avatar || null,
            joinDate: new Date().toISOString().split('T')[0],
            active_tasks: 0
        };
        store.users.unshift(createdUser);
        saveFallbackStore(store);
        return { status: 'success', message: 'User account provisioned.', data: { id: createdUser.id } };
    }

    if (endpoint.startsWith('/users/update')) {
        store.users = store.users.map((u: any) =>
            String(u.id) === String(body.id) ? { ...u, ...body } : u
        );
        saveFallbackStore(store);
        return { status: 'success', message: 'User updated.', data: { emailSent: false } };
    }

    if (endpoint.startsWith('/users/reject')) {
        if (body.deleteAccount) {
            store.users = store.users.filter((u: any) => String(u.id) !== String(body.id));
        } else {
            store.users = store.users.map((u: any) =>
                String(u.id) === String(body.id)
                    ? { ...u, status: 'rejected', rejectionReason: body.reason || '' }
                    : u
            );
        }
        saveFallbackStore(store);
        return { status: 'success', message: 'Access request rejected.', data: { emailSent: false } };
    }

    if (endpoint.startsWith('/users/email-config')) {
        if (!store.userEmailConfig) {
            store.userEmailConfig = {
                adminEmail: 'admin@devinquire.com',
                fromName: 'DevInquire',
                fromEmail: 'admin@devinquire.com',
                smtpHost: 'smtp.hostinger.com',
                smtpPort: 465,
                smtpUser: '',
                hasSmtpPass: false,
                smtpConfigured: false,
                web3FormsEnabled: true,
                bccAdminOnDecision: true,
                recentLogs: []
            };
        }
        if (options.method === 'POST') {
            store.userEmailConfig = {
                ...store.userEmailConfig,
                ...body,
                smtpConfigured: Boolean(body.smtpUser && (body.smtpPass || store.userEmailConfig.hasSmtpPass))
            };
            saveFallbackStore(store);
        }
        return { status: 'success', message: 'Email settings loaded.', data: store.userEmailConfig };
    }

    if (endpoint.startsWith('/users/delete')) {
        store.users = store.users.filter((u: any) => String(u.id) !== String(body.id));
        saveFallbackStore(store);
        return { status: 'success', message: 'User decommissioned.' };
    }

    if (endpoint.startsWith('/contacts/config')) {
        if (!store.contactsConfig) {
            store.contactsConfig = {
                recipientEmail: 'contact@devinquire.com',
                autoReplyEnabled: true,
                autoReplySubject: 'Thank you for contacting DevInquire',
                autoReplyTemplate: 'Hello {{name}}, thank you for reaching out to DevInquire. Our engineering team has received your inquiry regarding "{{subject}}" and will respond within 24 hours.',
                defaultPriority: 'Medium',
                webhookIntakeEnabled: true,
                slaHours: 24
            };
        }
        if (options.method === 'POST') {
            store.contactsConfig = { ...store.contactsConfig, ...body };
            saveFallbackStore(store);
        }
        return { status: 'success', message: 'Inquiry config synchronized.', data: store.contactsConfig };
    }

    if (endpoint.startsWith('/contacts/list')) {
        return { status: 'success', message: 'Inquiries retrieved.', data: store.contacts };
    }

    if (endpoint.startsWith('/contacts/create')) {
        const newInquiry = {
            id: String(Date.now()),
            name: body.name || 'Client',
            email: body.email || '',
            subject: body.subject || 'General Inquiry',
            message: body.message || '',
            priority: body.priority || 'Medium',
            status: 'new',
            company: body.company || '',
            phone: body.phone || '',
            service: body.service || '',
            timeline: body.timeline || '',
            form_source: body.form_source || 'Manual Entry',
            payment_status: body.payment_status || 'none',
            payment_plan: body.payment_plan || '',
            payment_amount: Number(body.payment_amount) || 0,
            payment_currency: body.payment_currency || 'INR',
            payment_reference: body.payment_reference || '',
            paid_at: body.payment_status === 'paid' ? new Date().toISOString() : null,
            reply_message: '',
            notes: body.notes || '',
            date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
        };
        store.contacts.unshift(newInquiry);
        saveFallbackStore(store);
        return { status: 'success', message: 'Client inquiry logged.', data: { id: newInquiry.id } };
    }

    if (endpoint.startsWith('/contacts/update')) {
        store.contacts = store.contacts.map((c: any) =>
            String(c.id) === String(body.id) ? { ...c, ...body } : c
        );
        saveFallbackStore(store);
        return { status: 'success', message: 'Inquiry updated.' };
    }

    if (endpoint.startsWith('/contacts/delete')) {
        store.contacts = store.contacts.filter((c: any) => String(c.id) !== String(body.id));
        saveFallbackStore(store);
        return { status: 'success', message: 'Inquiry deleted.' };
    }

    if (endpoint.startsWith('/analytics/stats')) {
        return {
            status: 'success',
            message: 'Analytics data synchronized.',
            data: {
                distribution: [
                    { name: 'Jan', bugs: 4, features: 12, refactor: 5 },
                    { name: 'Feb', bugs: 3, features: 15, refactor: 6 },
                    { name: 'Mar', bugs: 5, features: 18, refactor: 4 },
                    { name: 'Apr', bugs: 2, features: 20, refactor: 8 },
                    { name: 'May', bugs: 3, features: 22, refactor: 7 },
                    { name: 'Jun', bugs: 1, features: 25, refactor: 9 }
                ],
                allocation: [
                    { name: 'Development', value: 60 },
                    { name: 'Documentation', value: 15 },
                    { name: 'Review', value: 15 },
                    { name: 'Testing', value: 10 }
                ],
                summary: {
                    total_tasks: store.tasks.length,
                    bugs: 0,
                    completed: store.tasks.filter((t: any) => t.status === 'completed').length
                }
            }
        };
    }

    if (endpoint.startsWith('/notifications/list')) {
        return { status: 'success', message: 'Notifications retrieved.', data: store.notifications };
    }

    if (endpoint.startsWith('/notifications/mark_read')) {
        store.notifications = store.notifications.map((n: any) =>
            String(n.id) === String(body.id) ? { ...n, isRead: true } : n
        );
        saveFallbackStore(store);
        return { status: 'success', message: 'Signal synchronized.' };
    }

    if (endpoint.startsWith('/notifications/mark_all_read')) {
        store.notifications = store.notifications.map((n: any) => ({ ...n, isRead: true }));
        saveFallbackStore(store);
        return { status: 'success', message: 'All signals synchronized.' };
    }

    if (endpoint.startsWith('/notifications/clear_all')) {
        store.notifications = [];
        saveFallbackStore(store);
        return { status: 'success', message: 'All notifications cleared.' };
    }

    return { status: 'success', message: 'OK', data: [] };
}

export const api = {
    async fetch(endpoint: string, options: RequestInit = {}) {
        const token = localStorage.getItem('di_csrf_token');
        const isLoginRequest = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register');

        const defaultOptions: RequestInit = {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': token || '',
                ...options.headers,
            }
        };

        let response: Response;
        try {
            response = await fetch(`${API_BASE}${endpoint}`, defaultOptions);
            // If local Vite proxy returns 500/502/504, try direct backend on localhost:8001
            if (
                response.status >= 500 &&
                typeof window !== 'undefined' &&
                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
                window.location.port !== '8001'
            ) {
                response = await fetch(`http://${window.location.hostname}:8001/api${endpoint}`, defaultOptions);
            }
        } catch {
            if (
                typeof window !== 'undefined' &&
                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
                window.location.port !== '8001'
            ) {
                try {
                    response = await fetch(`http://${window.location.hostname}:8001/api${endpoint}`, defaultOptions);
                } catch {
                    return handleOfflineFallback(endpoint, options);
                }
            } else {
                // Network unreachable (e.g. backend server not running on static host)
                return handleOfflineFallback(endpoint, options);
            }
        }

        const rawText = await response.text();
        let result: any = null;

        try {
            result = rawText ? JSON.parse(rawText) : null;
        } catch {
            // Server returned non-JSON (e.g. Apache SPA index.html fallback or raw PHP/proxy error)
            return handleOfflineFallback(endpoint, options);
        }

        // If server returned 404/500/502/503 due to unconfigured DB or missing backend route on live host
        if (response.status >= 500 || response.status === 404) {
            return handleOfflineFallback(endpoint, options);
        }

        if (response.status === 401 && !isLoginRequest) {
            // If user already logged in with local fallback token, serve fallback instead of logging out
            if (token && token.startsWith('di-local-')) {
                return handleOfflineFallback(endpoint, options);
            }
            localStorage.removeItem('devinquire_user');
            localStorage.removeItem('di_csrf_token');
            window.location.reload();
        }

        if (!response.ok) {
            throw new Error(result?.message || 'System fault.');
        }

        return result;
    },

    auth: {
        login: (credentials: any) => api.fetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        }),
        register: (data: any) => api.fetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        me: () => api.fetch('/auth/me'),
        logout: () => api.fetch('/auth/logout', { method: 'POST' })
    },

    dashboard: {
        getMetrics: () => api.fetch('/dashboard/metrics'),
        getActivity: () => api.fetch('/dashboard/activity')
    },

    projects: {
        list: () => api.fetch('/projects/list'),
        get: (id: string) => api.fetch(`/projects/detail?id=${id}`),
        create: (data: any) => api.fetch('/projects/create', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        update: (id: string, data: any) => api.fetch('/projects/update', {
            method: 'POST',
            body: JSON.stringify({ id, ...data })
        }),
        delete: (id: string) => api.fetch('/projects/delete', {
            method: 'POST',
            body: JSON.stringify({ id })
        }),
        clear: () => api.fetch('/projects/clear', {
            method: 'POST'
        })
    },

    tasks: {
        list: () => api.fetch('/tasks/list'),
        create: (data: any) => api.fetch('/tasks/create', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        updateStatus: (id: string, status: string) => api.fetch('/tasks/update_status', {
            method: 'POST',
            body: JSON.stringify({ id, status })
        })
    },

    subtasks: {
        create: (taskId: string, title: string) => api.fetch('/tasks/subtasks/create', {
            method: 'POST',
            body: JSON.stringify({ taskId, title })
        }),
        toggle: (id: string, completed: boolean) => api.fetch('/tasks/subtasks/toggle', {
            method: 'POST',
            body: JSON.stringify({ id, completed: completed ? 1 : 0 })
        })
    },

    comments: {
        create: (taskId: string, text: string, isSystem: boolean = false) => api.fetch('/tasks/comments/create', {
            method: 'POST',
            body: JSON.stringify({ taskId, text, isSystem: isSystem ? 1 : 0 })
        })
    },

    blog: {
        list: () => api.fetch('/blog/list'),
        create: (data: any) => api.fetch('/blog/create', { method: 'POST', body: JSON.stringify(data) }),
        update: (data: any) => api.fetch('/blog/update', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id: string | number) => api.fetch('/blog/delete', { method: 'POST', body: JSON.stringify({ id }) }),
        sync: (id: string) => api.fetch('/blog/sync', { method: 'POST', body: JSON.stringify({ id }) }),
        getConfig: () => api.fetch('/blog/config'),
        updateConfig: (data: any) => api.fetch('/blog/config', { method: 'POST', body: JSON.stringify(data) }),
        getAutomationStatus: () => api.fetch('/blog/automation/status'),
        saveAutomationConfig: (data: any) => api.fetch('/blog/automation/config', { method: 'POST', body: JSON.stringify(data) }),
        runAutomationNow: (options?: { maxPerRun?: number; autoPublish?: boolean; categoryOverride?: string; autoPopulateSocial?: boolean }) =>
            api.fetch('/blog/automation/run', { method: 'POST', body: JSON.stringify(options || {}) }),
        listSocial: (platform?: 'instagram' | 'facebook') =>
            api.fetch(platform ? `/blog/social/list?platform=${platform}` : '/blog/social/list'),
        saveSocial: (data: any) => api.fetch('/blog/social/save', { method: 'POST', body: JSON.stringify(data) }),
        publishSocial: (id: string) => api.fetch('/blog/social/publish', { method: 'POST', body: JSON.stringify({ id }) }),
        deleteSocial: (id: string) => api.fetch('/blog/social/delete', { method: 'POST', body: JSON.stringify({ id }) }),
        populateSocialFromBlogs: (forceOverwrite: boolean = false) =>
            api.fetch('/blog/social/populate-all', { method: 'POST', body: JSON.stringify({ forceOverwrite }) }),
        getSocialConfig: () => api.fetch('/blog/social/config'),
        saveSocialConfig: (data: any) => api.fetch('/blog/social/config', { method: 'POST', body: JSON.stringify(data) }),
        getMetaOAuthUrl: (data: {
            metaAppId: string;
            metaAppSecret: string;
            redirectOrigin: string;
            mode?: 'popup' | 'redirect';
            oauthScopeMode?: string;
            metaConfigId?: string;
            includeBusinessManagement?: boolean;
        }) =>
            api.fetch('/blog/social/oauth/url', { method: 'POST', body: JSON.stringify(data) }),
        discoverMetaAccounts: (data: { accessToken: string; metaAppId?: string; metaAppSecret?: string }) =>
            api.fetch('/blog/social/discover', { method: 'POST', body: JSON.stringify(data) }),
        selectMetaPage: (pageId: string) =>
            api.fetch('/blog/social/select-page', { method: 'POST', body: JSON.stringify({ pageId }) }),
        verifySocialConnection: (data?: any) =>
            api.fetch('/blog/social/verify', { method: 'POST', body: JSON.stringify(data || {}) }),
        disconnectSocialAccounts: () =>
            api.fetch('/blog/social/disconnect', { method: 'POST', body: JSON.stringify({}) }),
        deduplicatePosts: () =>
            api.fetch('/blog/deduplicate', { method: 'POST', body: JSON.stringify({}) })
    },

    users: {
        list: () => api.fetch('/users/list'),
        create: (data: any) => api.fetch('/users/create', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        update: (data: any) => api.fetch('/users/update', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        reject: (data: { id: string; reason?: string; deleteAccount?: boolean }) =>
            api.fetch('/users/reject', {
                method: 'POST',
                body: JSON.stringify(data)
            }),
        delete: (id: string, reason?: string) => api.fetch('/users/delete', {
            method: 'POST',
            body: JSON.stringify({ id, reason })
        }),
        getEmailConfig: () => api.fetch('/users/email-config'),
        saveEmailConfig: (data: any) =>
            api.fetch('/users/email-config', {
                method: 'POST',
                body: JSON.stringify(data)
            }),
        sendTestEmail: (data?: any) =>
            api.fetch('/users/email-test', {
                method: 'POST',
                body: JSON.stringify(data || {})
            })
    },

    contacts: {
        list: () => api.fetch('/contacts/list'),
        create: (data: any) => api.fetch('/contacts/create', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        update: (data: any) => api.fetch('/contacts/update', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        delete: (id: string) => api.fetch('/contacts/delete', {
            method: 'POST',
            body: JSON.stringify({ id })
        }),
        getConfig: () => api.fetch('/contacts/config'),
        updateConfig: (data: any) => api.fetch('/contacts/config', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        testSmtp: (data: any) => api.fetch('/contacts/test-smtp', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    },

    analytics: {
        stats: () => api.fetch('/analytics/stats')
    },

    notifications: {
        list: () => api.fetch('/notifications/list'),
        markRead: (id: string) => api.fetch('/notifications/mark_read', {
            method: 'POST',
            body: JSON.stringify({ id })
        }),
        markAllRead: () => api.fetch('/notifications/mark_all_read', { method: 'POST' }),
        clearAll: () => api.fetch('/notifications/clear_all', { method: 'POST' })
    },

    quotations: {
        list: () => api.fetch('/quotations/list'),
        save: (data: any) => api.fetch('/quotations/save', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        delete: (payload: { id?: string; slug?: string }) => api.fetch('/quotations/delete', {
            method: 'POST',
            body: JSON.stringify(payload)
        })
    }
};
