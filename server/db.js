/**
 * Hybrid Database Connection Handler (PostgreSQL / Supabase, MySQL, or Embedded JSON Store Fallback)
 * Includes automatic schema bootstrap, column migration, and default Admin seeding.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

const { Pool } = pg;

const connectionString = (process.env.DATABASE_URL || "").trim();
const isPlaceholderPg =
  !connectionString ||
  connectionString.includes("127.0.0.1:5432") ||
  connectionString.includes("localhost:5432") ||
  connectionString.includes("your_supabase_password") ||
  connectionString.includes("[YOUR-PASSWORD]") ||
  connectionString.includes("[PASSWORD]");

const isSupabase =
  connectionString &&
  (connectionString.includes("supabase.co") ||
    connectionString.includes("supabase.com"));

let useMySQL = isPlaceholderPg || process.env.DB_TYPE === "mysql";
let useEmbeddedStore = false;
let pgPool = null;
let mysqlPool = null;

// Embedded persistent JSON store path (used when Postgres/MySQL daemon is unreachable)
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "local-db.json");
let embeddedData = null;
let embeddedMtime = 0;

function getDefaultSettings() {
  return {
    contacts_config: {
      recipientEmail: process.env.CONTACT_EMAIL || "contact@devinquire.com",
      fromName: process.env.MAIL_FROM_NAME || "DevInquire",
      fromEmail: process.env.MAIL_FROM_ADDRESS || "noreply@devinquire.com",
      smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
      smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
      smtpUser: process.env.SMTP_USERNAME || "",
      smtpPass: process.env.SMTP_PASSWORD || "",
      web3FormsEnabled: true,
      web3FormsKey:
        process.env.WEB3FORMS_ACCESS_KEY ||
        "803e30e6-5c54-4cae-9406-8d13bcf3d8e9",
      autoReplyEnabled: true,
      autoReplySubject: "Thank you for contacting DevInquire",
      autoReplyTemplate:
        "Hello {{name}}, thank you for reaching out to DevInquire. Our engineering team has received your inquiry regarding \"{{subject}}\" and will respond within 24 hours.",
      defaultPriority: "Medium",
      webhookIntakeEnabled: true,
      slaHours: 24,
    },
    blog_config: {
      siteUrl: process.env.MAIN_SITE_URL || "https://devinquire.com",
      defaultAuthor: "DevInquire Editorial",
      defaultStatus: "draft",
      autoSyncOnPublish: true,
      categories: [
        "Engineering",
        "Architecture",
        "AI & Systems",
        "Cloud & DevOps",
        "Product Strategy",
        "Security",
      ],
      seoTitleSuffix: " | DevInquire Insights",
    },
    social_config: {
      autoPopulateInstagram: true,
      autoPopulateFacebook: true,
      autoSyncOnBlogUpdate: true,
      autoPopulateDailyDev: true,
      autoPublishOnBlogPublish: true,
      instagramHandle: "@devinquire",
      facebookPageName: "DevInquire",
      defaultHashtags: ["DevInquire", "SoftwareEngineering", "TechInsights"],
      ctaTemplate: "Read the full engineering breakdown:",
      defaultSocialImageUrl:
        process.env.DEFAULT_SOCIAL_IMAGE_URL ||
        "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1080&q=80",
      metaAppId: process.env.META_APP_ID || "",
      metaAppSecret: process.env.META_APP_SECRET || "",
      instagramAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "",
      instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || "",
      facebookPageId: process.env.FACEBOOK_PAGE_ID || "",
      facebookAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "",
      webhookUrl: process.env.SOCIAL_AUTOMATION_WEBHOOK_URL || "",
      connectedPages: [],
      connectedAt: null,
      lastVerifiedAt: null,
      lastSyncAt: null,
      lastSyncedCount: 0,
      lastDispatchError: null,
    },
  };
}

function getEmbeddedStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const stat = fs.statSync(STORE_FILE);
      if (!embeddedData || stat.mtimeMs !== embeddedMtime) {
        embeddedData = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
        embeddedMtime = stat.mtimeMs;
      }
      if (!embeddedData.settings) {
        embeddedData.settings = getDefaultSettings();
        saveEmbeddedStore();
      } else {
        const defaults = getDefaultSettings();
        embeddedData.settings.contacts_config = {
          ...defaults.contacts_config,
          ...(embeddedData.settings.contacts_config || {}),
        };
        embeddedData.settings.blog_config = {
          ...defaults.blog_config,
          ...(embeddedData.settings.blog_config || {}),
        };
        embeddedData.settings.social_config = {
          ...defaults.social_config,
          ...(embeddedData.settings.social_config || {}),
        };
      }
      return embeddedData;
    }
  } catch {
    if (embeddedData) return embeddedData;
  }

  const now = new Date().toISOString();
  const defaultAdminHash = bcrypt.hashSync(
    process.env.ADMIN_PASSWORD || "DevInquire2025!",
    10,
  );

  embeddedData = {
    users: [
      {
        id: 1,
        email: process.env.ADMIN_EMAIL || "admin@devinquire.com",
        password: defaultAdminHash,
        name: "DevInquire Admin",
        role: "Admin",
        status: "active",
        avatar: null,
        join_date: now,
        created_at: now,
        updated_at: now,
      },
    ],
    projects: [],
    tasks: [],
    subtasks: [],
    task_comments: [],
    blog_posts: [],
    notifications: [],
    contacts: [],
    quotations: [],
    social_posts: [],
    settings: getDefaultSettings(),
  };

  saveEmbeddedStore();
  return embeddedData;
}

function saveEmbeddedStore() {
  if (!embeddedData) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(embeddedData, null, 2), "utf8");
  } catch {
    // ignore write errors on read-only fs
  }
}

function nextId(collection) {
  if (!Array.isArray(collection) || collection.length === 0) return 1;
  return Math.max(...collection.map((item) => Number(item.id) || 0)) + 1;
}

function executeEmbeddedQuery(text, params = []) {
  const store = getEmbeddedStore();
  const q = text.replace(/\s+/g, " ").trim();
  const qLower = q.toLowerCase();
  const now = new Date().toISOString();

  // DDL / Schema creation
  if (
    qLower.startsWith("create ") ||
    qLower.startsWith("alter ") ||
    qLower.startsWith("do $$") ||
    qLower === "select 1"
  ) {
    return { rows: [{ "?column?": 1 }], rowCount: 1 };
  }

  // USERS queries
  if (qLower.includes("from users") && qLower.startsWith("select")) {
    if (qLower.includes("lower(email)") || qLower.includes("where email")) {
      const targetEmail = String(params[0] || "").trim().toLowerCase();
      const found = store.users.filter(
        (u) => String(u.email).toLowerCase() === targetEmail,
      );
      return { rows: found.map((u) => ({ ...u })), rowCount: found.length };
    }
    if (qLower.includes("where id =")) {
      const targetId = Number(params[0]);
      const found = store.users.filter((u) => Number(u.id) === targetId);
      return { rows: found.map((u) => ({ ...u })), rowCount: found.length };
    }
    // Full user list with active_tasks count
    const rows = store.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      avatar: u.avatar,
      joinDate: u.created_at,
      active_tasks: store.tasks.filter(
        (t) => Number(t.assignee_id) === Number(u.id) && t.status !== "completed",
      ).length,
    }));
    return { rows, rowCount: rows.length };
  }

  if (qLower.startsWith("insert into users")) {
    const id = nextId(store.users);
    const defaultRole = qLower.includes("'developer'") ? "Developer" : qLower.includes("'viewer'") ? "Viewer" : "Admin";
    const defaultStatus = qLower.includes("'pending'") ? "pending" : "active";
    const newUser = {
      id,
      email: params[0],
      password: params[1],
      name: params[2] || "DevInquire Admin",
      role: params[3] || defaultRole,
      status: params[4] || defaultStatus,
      avatar: params[5] || null,
      join_date: now,
      created_at: now,
      updated_at: now,
    };
    store.users.push(newUser);
    saveEmbeddedStore();
    return { rows: [{ id }], rowCount: 1 };
  }

  if (qLower.startsWith("update users set")) {
    const targetId = Number(params[params.length - 1]);
    store.users = store.users.map((u) => {
      if (Number(u.id) !== targetId) return u;
      const updated = { ...u, updated_at: now };
      if (qLower.includes("password = $1") && qLower.includes("status = 'active'")) {
        updated.password = params[0];
        updated.status = "active";
        updated.role = "Admin";
      } else {
        // Dynamic user update from users.js
        const setClause = q.substring(qLower.indexOf("set ") + 4, qLower.indexOf(" where"));
        const parts = setClause.split(",").map((s) => s.trim());
        parts.forEach((part, idx) => {
          const col = part.split("=")[0].trim().toLowerCase();
          if (params[idx] !== undefined) updated[col] = params[idx];
        });
      }
      return updated;
    });
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  if (qLower.startsWith("delete from users")) {
    const targetId = Number(params[0]);
    store.users = store.users.filter((u) => Number(u.id) !== targetId);
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  // DASHBOARD activity UNION query
  if (qLower.includes("union") && qLower.includes("from projects")) {
    const projActs = store.projects.slice(0, 5).map((p) => ({
      type: "deploy",
      user: "AutoBot",
      target: `${p.name} to Production`,
      action: "deployed",
      time: p.created_at,
    }));
    const contactActs = store.contacts.slice(0, 5).map((c) => ({
      type: "pr",
      user: c.name,
      target: c.subject,
      action: "submitted inquiry",
      time: c.created_at,
    }));
    const combined = [...projActs, ...contactActs].slice(0, 10);
    return { rows: combined, rowCount: combined.length };
  }

  // PROJECTS queries
  if (qLower.includes("from projects") && qLower.startsWith("select")) {
    if (qLower.includes("count(*)")) {
      return { rows: [{ total: store.projects.length }], rowCount: 1 };
    }
    if (qLower.includes("avg(health)")) {
      const avg =
        store.projects.length > 0
          ? store.projects.reduce((s, p) => s + (Number(p.health) || 100), 0) /
            store.projects.length
          : 100;
      return { rows: [{ avg }], rowCount: 1 };
    }
    if (qLower.includes("where id =")) {
      const targetId = Number(params[0]);
      const found = store.projects.filter((p) => Number(p.id) === targetId);
      return { rows: found.map((p) => ({ ...p })), rowCount: found.length };
    }
    if (qLower.includes("where name =")) {
      const found = store.projects.filter((p) => p.name === params[0]);
      return { rows: found.map((p) => ({ ...p })), rowCount: found.length };
    }
    return {
      rows: [...store.projects].reverse(),
      rowCount: store.projects.length,
    };
  }

  if (qLower.startsWith("insert into projects")) {
    const id = nextId(store.projects);
    const meta = (params[6] && typeof params[6] === "object") ? params[6] : {};
    const newProj = {
      id,
      name: params[0],
      description: params[1] || "",
      language: params[2] || "TypeScript",
      status: params[3] || "active",
      health: params[4] !== undefined ? Number(params[4]) : 100,
      progress: params[5] !== undefined ? Number(params[5]) : 0,
      clientName: meta.clientName || "Enterprise Client",
      assignedDeveloper: meta.assignedDeveloper || "System Alpha",
      assignedViewer: meta.assignedViewer || "Viewer",
      dueDate: meta.dueDate || now.split("T")[0],
      updates: Array.isArray(meta.updates)
        ? meta.updates
        : [
            {
              id: `upd-${Date.now()}`,
              title: "Project Kickoff & Architecture Initialized",
              summary: params[1] || "Initial workspace and milestone tracking configured.",
              author: meta.assignedDeveloper || "System Alpha",
              date: now.split("T")[0],
              progress: params[5] !== undefined ? Number(params[5]) : 0,
            },
          ],
      repo_url: null,
      last_update: now,
      created_at: now,
    };
    store.projects.push(newProj);
    saveEmbeddedStore();
    return { rows: [{ id }], rowCount: 1 };
  }

  if (qLower.startsWith("update projects set")) {
    const targetId = Number(params[params.length - 1]);
    store.projects = store.projects.map((p) => {
      if (Number(p.id) !== targetId) return p;
      const updated = { ...p, last_update: now };
      const setClause = q.substring(qLower.indexOf("set ") + 4, qLower.indexOf(" where"));
      const parts = setClause.split(",").map((s) => s.trim());
      parts.forEach((part, idx) => {
        const col = part.split("=")[0].trim();
        const colKey = col.toLowerCase();
        if (params[idx] !== undefined) {
          if (colKey === "clientname" || colKey === "client_name") updated.clientName = params[idx];
          else if (colKey === "assigneddeveloper" || colKey === "assigned_developer") updated.assignedDeveloper = params[idx];
          else if (colKey === "assignedviewer" || colKey === "assigned_viewer") updated.assignedViewer = params[idx];
          else if (colKey === "duedate" || colKey === "due_date") updated.dueDate = params[idx];
          else if (colKey === "updates") updated.updates = params[idx];
          else updated[colKey] = params[idx];
        }
      });
      return updated;
    });
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  // TASKS queries
  if (qLower.includes("from tasks") && qLower.startsWith("select")) {
    if (qLower.includes("count(*) as bugs")) {
      const bugs = store.tasks.filter(
        (t) =>
          String(t.title || "").toLowerCase().includes("bug") ||
          String(t.description || "").toLowerCase().includes("error"),
      ).length;
      return { rows: [{ bugs }], rowCount: 1 };
    }
    if (qLower.includes("count(*) as completed")) {
      const completed = store.tasks.filter((t) => t.status === "completed").length;
      return { rows: [{ completed }], rowCount: 1 };
    }
    if (qLower.includes("count(*)") && qLower.includes("status != 'completed'")) {
      const total = store.tasks.filter((t) => t.status !== "completed").length;
      return { rows: [{ total }], rowCount: 1 };
    }
    if (qLower.includes("count(*)")) {
      return { rows: [{ total: store.tasks.length }], rowCount: 1 };
    }
    let list = [...store.tasks];
    if (qLower.includes("where t.project_id =") || qLower.includes("where project_id =")) {
      const pid = Number(params[0]);
      list = list.filter((t) => Number(t.project_id) === pid);
    }
    const enriched = list.reverse().map((t) => {
      const proj = store.projects.find((p) => Number(p.id) === Number(t.project_id));
      const user = store.users.find((u) => Number(u.id) === Number(t.assignee_id));
      return {
        ...t,
        project_name: proj ? proj.name : "General",
        assignee_name: user ? user.name : "Unassigned",
        assignee_avatar: user ? user.avatar : null,
      };
    });
    return { rows: enriched, rowCount: enriched.length };
  }

  if (qLower.startsWith("insert into tasks")) {
    const id = nextId(store.tasks);
    let parsedTags = params[7];
    if (typeof parsedTags === "string") {
      try {
        parsedTags = JSON.parse(parsedTags);
      } catch {
        parsedTags = [];
      }
    }
    const newTask = {
      id,
      project_id: params[0] || 1,
      title: params[1],
      description: params[2] || "",
      assignee_id: params[3] || 1,
      status: params.length === 9 ? params[4] : "todo",
      priority: params.length === 9 ? params[5] : params[4] || "Medium",
      due_date: params.length === 9 ? params[6] : params[5] || now.split("T")[0],
      points: params.length === 9 ? params[7] : params[6] || 0,
      tags: Array.isArray(parsedTags) ? parsedTags : [],
      created_at: now,
    };
    store.tasks.push(newTask);
    saveEmbeddedStore();
    return { rows: [{ id }], rowCount: 1 };
  }

  if (qLower.startsWith("update tasks set status")) {
    const status = params[0];
    const targetId = Number(params[1]);
    store.tasks = store.tasks.map((t) =>
      Number(t.id) === targetId ? { ...t, status } : t,
    );
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  // SUBTASKS queries
  if (qLower.includes("from subtasks") && qLower.startsWith("select")) {
    const tid = Number(params[0]);
    const rows = store.subtasks.filter((st) => Number(st.task_id) === tid);
    return { rows, rowCount: rows.length };
  }

  if (qLower.startsWith("insert into subtasks")) {
    const id = nextId(store.subtasks);
    store.subtasks.push({
      id,
      task_id: Number(params[0]),
      title: params[1],
      completed: Boolean(params[2]),
      completed_at: params[3] || null,
    });
    saveEmbeddedStore();
    return { rows: [{ id }], rowCount: 1 };
  }

  if (qLower.startsWith("update subtasks set")) {
    const targetId = Number(params[2]);
    store.subtasks = store.subtasks.map((st) =>
      Number(st.id) === targetId
        ? { ...st, completed: Boolean(params[0]), completed_at: params[1] }
        : st,
    );
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  // TASK COMMENTS queries
  if (qLower.includes("from task_comments") && qLower.startsWith("select")) {
    const tid = Number(params[0]);
    const rows = store.task_comments
      .filter((tc) => Number(tc.task_id) === tid)
      .reverse()
      .map((tc) => {
        const u = store.users.find((usr) => Number(usr.id) === Number(tc.user_id));
        return {
          ...tc,
          user_name: u ? u.name : "System",
          user_avatar: u ? u.avatar : null,
        };
      });
    return { rows, rowCount: rows.length };
  }

  if (qLower.startsWith("insert into task_comments")) {
    const id = nextId(store.task_comments);
    if (params.length === 1) {
      store.task_comments.push({
        id,
        task_id: Number(params[0]),
        user_id: null,
        text: "Task initialized in the ledger.",
        is_system_log: true,
        created_at: now,
      });
    } else {
      store.task_comments.push({
        id,
        task_id: Number(params[0]),
        user_id: params[1],
        text: params[2],
        is_system_log: Boolean(params[3]),
        created_at: now,
      });
    }
    saveEmbeddedStore();
    return { rows: [{ id }], rowCount: 1 };
  }

  // BLOG POSTS queries
  if (qLower.includes("from blog_posts") && qLower.startsWith("select")) {
    let posts = [...store.blog_posts];
    if (qLower.includes("b.status = 'published'")) {
      posts = posts.filter((p) => p.status === "published" || p.status === "synced");
    }
    if (qLower.includes("b.id =") || qLower.includes("where id =")) {
      const targetId = Number(params[0]);
      posts = posts.filter((p) => Number(p.id) === targetId);
    } else if (qLower.includes("b.slug =") || qLower.includes("where slug =")) {
      const targetSlug = String(params[0] || "").trim().toLowerCase();
      posts = posts.filter((p) => String(p.slug || "").toLowerCase() === targetSlug);
    } else if (qLower.includes("b.category =")) {
      const targetCat = String(params[0] || "").trim().toLowerCase();
      posts = posts.filter((p) => String(p.category || "").toLowerCase() === targetCat);
    }
    const defaultAuthor =
      store.settings?.blog_config?.defaultAuthor || "DevInquire Editorial";
    const rows = posts.reverse().map((b) => {
      const u = store.users.find((usr) => Number(usr.id) === Number(b.author_id));
      const slug =
        b.slug ||
        String(b.title || `post-${b.id}`)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "");
      return {
        ...b,
        slug,
        author_name: b.author_name || (u ? u.name : defaultAuthor),
      };
    });
    return { rows, rowCount: rows.length };
  }

  if (qLower.startsWith("insert into blog_posts")) {
    const id = nextId(store.blog_posts);
    let parsedTags = params[5];
    if (typeof parsedTags === "string") {
      try {
        parsedTags = JSON.parse(parsedTags);
      } catch {
        parsedTags = [];
      }
    }
    const meta = params[6] && typeof params[6] === "object" ? params[6] : {};
    const rawTitle = String(params[0] || `Post ${id}`);
    const generatedSlug =
      meta.slug ||
      rawTitle
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const defaultAuthor =
      store.settings?.blog_config?.defaultAuthor || "DevInquire Editorial";

    store.blog_posts.push({
      id,
      title: rawTitle,
      slug: generatedSlug,
      excerpt: params[1] || "",
      content: params[2] || "",
      author_id: params[3] || 1,
      author_name: meta.author_name || defaultAuthor,
      category: params[4] || "Engineering",
      tags: Array.isArray(parsedTags) ? parsedTags : [],
      status: meta.status || store.settings?.blog_config?.defaultStatus || "draft",
      featured_image: meta.featured_image || null,
      read_time: meta.read_time || 5,
      is_featured: Boolean(meta.is_featured),
      created_at: now,
      updated_at: now,
    });
    saveEmbeddedStore();
    return { rows: [{ id, slug: generatedSlug }], rowCount: 1 };
  }

  if (qLower.startsWith("update blog_posts set")) {
    if (qLower.includes("status = 'published' where id = $1")) {
      const targetId = Number(params[0]);
      store.blog_posts = store.blog_posts.map((b) =>
        Number(b.id) === targetId ? { ...b, status: "published", updated_at: now } : b,
      );
    } else {
      const targetId = Number(params[params.length - 1]);
      store.blog_posts = store.blog_posts.map((b) => {
        if (Number(b.id) !== targetId) return b;
        const updated = { ...b, updated_at: now };
        const setClause = q.substring(qLower.indexOf("set ") + 4, qLower.indexOf(" where"));
        const parts = setClause.split(",").map((s) => s.trim());
        parts.forEach((part, idx) => {
          const col = part.split("=")[0].trim().toLowerCase();
          if (params[idx] !== undefined) {
            updated[col] = col === "tags" && typeof params[idx] === "string"
              ? JSON.parse(params[idx])
              : params[idx];
          }
        });
        if (updated.title && !updated.slug) {
          updated.slug = String(updated.title)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/^-+|-+$/g, "");
        }
        return updated;
      });
    }
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  if (qLower.startsWith("delete from blog_posts")) {
    const targetId = Number(params[0]);
    store.blog_posts = store.blog_posts.filter((b) => Number(b.id) !== targetId);
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  // CONTACTS queries
  if (qLower.includes("from contacts") && qLower.startsWith("select")) {
    if (qLower.includes("count(*)")) {
      const total = store.contacts.filter((c) => c.status === "new").length;
      return { rows: [{ total }], rowCount: 1 };
    }
    return {
      rows: [...store.contacts].reverse(),
      rowCount: store.contacts.length,
    };
  }

  if (qLower.startsWith("insert into contacts")) {
    const id = nextId(store.contacts);
    const meta = params[5] && typeof params[5] === "object" ? params[5] : {};
    const defaultPriority =
      store.settings?.contacts_config?.defaultPriority || "Medium";
    store.contacts.push({
      id,
      name: params[0],
      email: params[1],
      subject: params[2] || "General Inquiry",
      message: params[3] || "",
      priority: params[4] || defaultPriority,
      status: meta.status || "new",
      company: meta.company || "",
      phone: meta.phone || "",
      service: meta.service || "",
      timeline: meta.timeline || "",
      reply_message: meta.reply_message || "",
      replied_at: meta.replied_at || null,
      notes: meta.notes || "",
      created_at: now,
    });
    saveEmbeddedStore();
    return { rows: [{ id }], rowCount: 1 };
  }

  if (qLower.startsWith("update contacts set")) {
    const targetId = Number(params[params.length - 1]);
    store.contacts = store.contacts.map((c) => {
      if (Number(c.id) !== targetId) return c;
      const updated = { ...c };
      const setClause = q.substring(qLower.indexOf("set ") + 4, qLower.indexOf(" where"));
      const parts = setClause.split(",").map((s) => s.trim());
      parts.forEach((part, idx) => {
        const col = part.split("=")[0].trim().toLowerCase();
        if (params[idx] !== undefined) updated[col] = params[idx];
      });
      return updated;
    });
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  if (qLower.startsWith("delete from contacts")) {
    const targetId = Number(params[0]);
    store.contacts = store.contacts.filter((c) => Number(c.id) !== targetId);
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  // QUOTATIONS queries
  if (!Array.isArray(store.quotations)) store.quotations = [];

  if (qLower.includes("create table if not exists quotations")) {
    return { rows: [], rowCount: 0 };
  }

  if (qLower.includes("from quotations") && qLower.startsWith("select")) {
    if (qLower.includes("where slug = $1")) {
      const targetSlug = String(params[0] || "").toLowerCase();
      const found = store.quotations.filter((qt) => String(qt.slug || "").toLowerCase() === targetSlug);
      return { rows: found, rowCount: found.length };
    }
    const rows = [...store.quotations].reverse();
    return { rows, rowCount: rows.length };
  }

  if (qLower.startsWith("insert into quotations")) {
    const id = nextId(store.quotations);
    store.quotations.push({
      id,
      slug: params[0],
      quotation_no: params[1],
      client_name: params[2],
      payload: params[3],
      created_at: now,
      updated_at: now,
    });
    saveEmbeddedStore();
    return { rows: [{ id }], rowCount: 1 };
  }

  if (qLower.startsWith("update quotations set")) {
    const targetId = Number(params[3]);
    store.quotations = store.quotations.map((qt) =>
      Number(qt.id) === targetId
        ? {
            ...qt,
            quotation_no: params[0],
            client_name: params[1],
            payload: params[2],
            updated_at: now,
          }
        : qt
    );
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  if (qLower.startsWith("delete from quotations")) {
    const target = params[0];
    if (qLower.includes("where slug = $1")) {
      store.quotations = store.quotations.filter((qt) => String(qt.slug) !== String(target));
    } else {
      store.quotations = store.quotations.filter((qt) => Number(qt.id) !== Number(target));
    }
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  // SOCIAL POSTS queries
  if (!Array.isArray(store.social_posts)) store.social_posts = [];

  if (qLower.includes("from social_posts") && qLower.startsWith("select")) {
    let items = [...store.social_posts];
    if (qLower.includes("where blog_id = $1 and platform = $2")) {
      const targetBlogId = Number(params[0]);
      const targetPlatform = String(params[1] || "").toLowerCase();
      items = items.filter(
        (sp) =>
          Number(sp.blog_id) === targetBlogId &&
          String(sp.platform || "").toLowerCase() === targetPlatform,
      );
      return { rows: items.slice(0, 1), rowCount: Math.min(items.length, 1) };
    }
    if (qLower.includes("where blog_id = $1")) {
      const targetBlogId = Number(params[0]);
      items = items.filter((sp) => Number(sp.blog_id) === targetBlogId);
      return { rows: items, rowCount: items.length };
    }
    if (qLower.includes("where id = $1")) {
      const targetId = Number(params[0]);
      items = items.filter((sp) => Number(sp.id) === targetId);
      return { rows: items.slice(0, 1), rowCount: Math.min(items.length, 1) };
    }
    if (qLower.includes("where platform = $1")) {
      const targetPlatform = String(params[0] || "").toLowerCase();
      items = items.filter(
        (sp) => String(sp.platform || "").toLowerCase() === targetPlatform,
      );
    }
    const rows = items.reverse();
    return { rows, rowCount: rows.length };
  }

  if (qLower.startsWith("insert into social_posts")) {
    const id = nextId(store.social_posts);
    store.social_posts.push({
      id,
      blog_id: params[0] !== undefined && params[0] !== null ? Number(params[0]) : null,
      platform: params[1] || "instagram",
      title: params[2] || "",
      caption: params[3] || "",
      status: params[4] || "draft",
      payload: params[5] || "{}",
      created_at: now,
      updated_at: now,
    });
    saveEmbeddedStore();
    return { rows: [{ id }], rowCount: 1 };
  }

  if (qLower.startsWith("update social_posts set")) {
    const targetId = Number(params[4]);
    store.social_posts = store.social_posts.map((sp) =>
      Number(sp.id) === targetId
        ? {
            ...sp,
            title: params[0],
            caption: params[1],
            status: params[2],
            payload: params[3],
            updated_at: now,
          }
        : sp,
    );
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  if (qLower.startsWith("delete from social_posts")) {
    const target = params[0];
    if (qLower.includes("where blog_id = $1")) {
      store.social_posts = store.social_posts.filter(
        (sp) => Number(sp.blog_id) !== Number(target),
      );
    } else {
      store.social_posts = store.social_posts.filter(
        (sp) => Number(sp.id) !== Number(target),
      );
    }
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  // NOTIFICATIONS queries
  if (qLower.includes("from notifications") && qLower.startsWith("select")) {
    const uid = Number(params[0]);
    const rows = store.notifications
      .filter((n) => n.user_id === null || Number(n.user_id) === uid)
      .reverse()
      .slice(0, 50);
    return { rows, rowCount: rows.length };
  }

  if (qLower.startsWith("insert into notifications")) {
    const id = nextId(store.notifications);
    store.notifications.push({
      id,
      user_id: params[0],
      type: params[1] || "info",
      title: params[2] || "",
      message: params[3] || "",
      link: params[4] || null,
      is_read: false,
      created_at: now,
    });
    saveEmbeddedStore();
    return { rows: [{ id }], rowCount: 1 };
  }

  if (qLower.startsWith("update notifications set is_read = true")) {
    if (params.length === 2) {
      const targetId = Number(params[0]);
      store.notifications = store.notifications.map((n) =>
        Number(n.id) === targetId ? { ...n, is_read: true } : n,
      );
    } else {
      const uid = Number(params[0]);
      store.notifications = store.notifications.map((n) =>
        n.user_id === null || Number(n.user_id) === uid
          ? { ...n, is_read: true }
          : n,
      );
    }
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  if (qLower.startsWith("delete from notifications")) {
    const uid = Number(params[0]);
    store.notifications = store.notifications.filter(
      (n) => n.user_id !== null && Number(n.user_id) !== uid,
    );
    saveEmbeddedStore();
    return { rows: [], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

function createMySqlPool(overrides = {}) {
  return mysql.createPool({
    host: overrides.host || process.env.DB_HOST || "127.0.0.1",
    port: parseInt(
      overrides.port || process.env.DB_PORT_MYSQL || process.env.DB_PORT || "3306",
      10,
    ),
    user: overrides.user || process.env.DB_USER || "root",
    password:
      overrides.password !== undefined
        ? overrides.password
        : process.env.DB_PASS || "",
    database: overrides.database || process.env.DB_NAME || "devinquire_db",
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_MAX || "20", 10),
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || "0", 10),
    multipleStatements: true,
  });
}

if (useMySQL) {
  console.log(
    "Database Client: Using MySQL driver (port " +
      (process.env.DB_PORT_MYSQL || "3306") +
      ")...",
  );
  mysqlPool = createMySqlPool();
} else {
  console.log("Database Client: Activating PostgreSQL/Supabase driver...");
  pgPool = new Pool({
    connectionString,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_POOL_MAX || "20", 10),
    idleTimeoutMillis: parseInt(
      process.env.DB_POOL_IDLE_TIMEOUT || "30000",
      10,
    ),
    connectionTimeoutMillis: parseInt(
      process.env.DB_POOL_CONN_TIMEOUT || "5000",
      10,
    ),
  });

  pgPool.on("error", (err) => {
    console.error("Unexpected error on inactive Postgres client", err.message);
  });
}

function translatePgToMySQL(text) {
  let translatedText = text;
  translatedText = translatedText.replace(/DO \$\$[\s\S]*?END \$\$;/gi, "");
  translatedText = translatedText.replace(
    /\bSERIAL PRIMARY KEY\b/gi,
    "INT AUTO_INCREMENT PRIMARY KEY",
  );
  translatedText = translatedText.replace(
    /\bTIMESTAMP WITH TIME ZONE\b/gi,
    "TIMESTAMP",
  );
  translatedText = translatedText.replace(/::[a-zA-Z_0-9]+/g, "");
  translatedText = translatedText.replace(
    /\b(user_role|user_status|project_status|task_status|task_priority|blog_status|notification_type|contact_status|contact_priority)\b/gi,
    "VARCHAR(50)",
  );
  translatedText = translatedText.replace(/\bJSONB\b/gi, "JSON");
  translatedText = translatedText.replace(/\$\d+/g, "?");
  translatedText = translatedText.replace(/\bILIKE\b/gi, "LIKE");
  translatedText = translatedText.replace(
    /CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+\w+\s*\([^)]+\);/gi,
    "",
  );
  translatedText = translatedText.replace(
    /DEFAULT\s+'\[\]'(::jsonb)?/gi,
    "",
  );
  translatedText = translatedText.replace(
    /\bAS\s+"([a-zA-Z0-9_]+)"/gi,
    "AS `$1`",
  );
  translatedText = translatedText.replace(
    /\bORDER\s+BY\s+"([a-zA-Z0-9_]+)"/gi,
    "ORDER BY `$1`",
  );

  const returningMatch = translatedText.match(
    /RETURNING\s+([\w,\s*]+?);?$/i,
  );
  const returningColumns = returningMatch
    ? returningMatch[1]
        .split(",")
        .map((c) => c.trim().replace(/^["`]|["`]$/g, ""))
    : null;
  translatedText = translatedText
    .replace(/\s+RETURNING\s+[\w,\s*]+?;?$/i, ";")
    .trim();
  if (!translatedText.endsWith(";")) translatedText += ";";

  return { translatedText, returningColumns };
}

export const db = {
  getSettings(key) {
    const store = getEmbeddedStore();
    const defaults = getDefaultSettings();
    if (!store.settings) store.settings = defaults;
    if (!key) return store.settings;
    return {
      ...(defaults[key] || {}),
      ...(store.settings[key] || {}),
    };
  },

  updateSettings(key, patch) {
    const store = getEmbeddedStore();
    const defaults = getDefaultSettings();
    if (!store.settings) store.settings = defaults;
    store.settings[key] = {
      ...(defaults[key] || {}),
      ...(store.settings[key] || {}),
      ...(patch || {}),
    };
    saveEmbeddedStore();

    if (!useEmbeddedStore) {
      const jsonVal = JSON.stringify(store.settings[key]);
      if (useMySQL && mysqlPool) {
        mysqlPool
          .query(
            "INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
            [key, jsonVal],
          )
          .catch(() => {});
      } else if (pgPool) {
        pgPool
          .query(
            "INSERT INTO system_settings (setting_key, setting_value) VALUES ($1, $2::jsonb) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value",
            [key, jsonVal],
          )
          .catch(() => {});
      }
    }

    return store.settings[key];
  },

  async query(text, params = []) {
    if (useEmbeddedStore) {
      return executeEmbeddedQuery(text, params);
    }

    const start = Date.now();

    if (!useMySQL && pgPool) {
      try {
        const res = await pgPool.query(text, params);
        return res;
      } catch (err) {
        const isConnOrAuthError =
          err.code === "ECONNREFUSED" ||
          err.code === "EPERM" ||
          err.code === "ENOTFOUND" ||
          err.code === "ETIMEDOUT" ||
          err.code === "28P01" ||
          err.code === "3D000" ||
          err.code === "XX000" ||
          (err.message &&
            (err.message.includes("connect ECONNREFUSED") ||
              err.message.includes("password authentication failed") ||
              err.message.includes("Tenant or user not found")));

        if (isConnOrAuthError) {
          console.warn(
            "[DB] PostgreSQL unreachable (" +
              (err.code || err.message) +
              "). Switching to MySQL fallback...",
          );
          useMySQL = true;
          if (!mysqlPool) {
            mysqlPool = createMySqlPool();
          }
        } else {
          throw err;
        }
      }
    }

    if (!mysqlPool) {
      mysqlPool = createMySqlPool();
    }

    const { translatedText, returningColumns } = translatePgToMySQL(text);
    const placeholderCount = (translatedText.match(/\?/g) || []).length;
    const mysqlParams =
      params.length > placeholderCount
        ? params.slice(0, placeholderCount)
        : params;

    try {
      const result = await mysqlPool.query(translatedText, mysqlParams);
      const rawRows = result[0];

      // Mirror mutating queries into local-db.json so local-db.json is always synced
      const trimmedLower = text.trim().toLowerCase();
      if (
        trimmedLower.startsWith("insert ") ||
        trimmedLower.startsWith("update ") ||
        trimmedLower.startsWith("delete ")
      ) {
        try {
          executeEmbeddedQuery(text, params);
        } catch {
          // ignore embedded mirror errors
        }
      }

      if (
        returningColumns &&
        !Array.isArray(rawRows) &&
        rawRows.insertId !== undefined
      ) {
        const returnedRow = {};
        for (const col of returningColumns) {
          if (col === "*") continue;
          if (col.toLowerCase() === "id") {
            returnedRow[col] = rawRows.insertId;
          }
        }
        return {
          rows: Object.keys(returnedRow).length ? [returnedRow] : [],
          rowCount: rawRows.affectedRows || 1,
        };
      }

      return {
        rows: Array.isArray(rawRows) ? rawRows : [rawRows],
        rowCount: Array.isArray(rawRows)
          ? rawRows.length
          : rawRows.affectedRows !== undefined
            ? rawRows.affectedRows
            : 1,
      };
    } catch (err) {
      const isMySqlUnreachable =
        err.code === "ECONNREFUSED" ||
        err.code === "EPERM" ||
        err.code === "ENOTFOUND" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ER_BAD_DB_ERROR" ||
        err.code === "ER_ACCESS_DENIED_ERROR";

      if (isMySqlUnreachable) {
        console.warn(
          `[DB] MySQL daemon unreachable (${err.code || err.message}). Activating embedded persistent JSON store (${STORE_FILE}).`,
        );
        useEmbeddedStore = true;
        return executeEmbeddedQuery(text, params);
      }

      const duration = Date.now() - start;
      const isProd = process.env.NODE_ENV === "production";
      console.error(
        "[DB][MySQL] Query execution error",
        JSON.stringify({
          ts: new Date().toISOString(),
          original: text.trim().substring(0, 200),
          duration,
          code: err.code,
          message: err.message,
        }),
      );
      const sanitized = new Error(
        isProd
          ? "Database query failed."
          : `[MySQL] ${err.code || err.errno || "DBError"}: ${err.message}`,
      );
      sanitized.code = err.code || "DB_ERROR";
      throw sanitized;
    }
  },

  async bootstrap() {
    try {
      if (useMySQL && mysqlPool && !useEmbeddedStore) {
        try {
          await mysqlPool.query("SELECT 1");
        } catch (connErr) {
          if (
            !process.env.DB_USER &&
            (connErr.code === "ER_BAD_DB_ERROR" ||
              connErr.code === "ER_ACCESS_DENIED_ERROR")
          ) {
            try {
              const hostingerPool = createMySqlPool({
                host: "localhost",
                user: "u180145459_dashboard_dev",
                password: "DevInquire2026!",
                database: "u180145459_dashboard_dev",
              });
              await hostingerPool.query("SELECT 1");
              mysqlPool = hostingerPool;
            } catch {
              useEmbeddedStore = true;
            }
          } else if (
            connErr.code === "ECONNREFUSED" ||
            connErr.code === "EPERM" ||
            connErr.code === "ENOTFOUND"
          ) {
            console.log(
              `[DB] Local MySQL not running (${connErr.code}). Using embedded persistent JSON database (${STORE_FILE}).`,
            );
            useEmbeddedStore = true;
          }
        }
      }

      if (useEmbeddedStore) {
        getEmbeddedStore();
        console.log(
          "[DB] Embedded database initialized with default Admin (admin@devinquire.com).",
        );
        return;
      }

      const ddlStatements = [
        `CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(191) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          role user_role DEFAULT 'Viewer',
          status user_status DEFAULT 'pending',
          avatar VARCHAR(255) DEFAULT NULL,
          join_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          clientName VARCHAR(150) DEFAULT NULL,
          assignedDeveloper VARCHAR(100) DEFAULT NULL,
          assignedViewer VARCHAR(150) DEFAULT NULL,
          dueDate VARCHAR(50) DEFAULT NULL,
          updates JSONB DEFAULT '[]'::jsonb,
          description TEXT,
          language VARCHAR(50) DEFAULT 'TypeScript',
          status project_status DEFAULT 'active',
          health INT DEFAULT 100,
          progress INT DEFAULT 0,
          repo_url VARCHAR(255) DEFAULT NULL,
          last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          project_id INT,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          assignee_id INT,
          status task_status DEFAULT 'todo',
          priority task_priority DEFAULT 'Medium',
          due_date DATE DEFAULT NULL,
          points INT DEFAULT 0,
          tags JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS subtasks (
          id SERIAL PRIMARY KEY,
          task_id INT NOT NULL,
          title VARCHAR(200) NOT NULL,
          completed BOOLEAN DEFAULT FALSE,
          completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS task_comments (
          id SERIAL PRIMARY KEY,
          task_id INT NOT NULL,
          user_id INT,
          text TEXT NOT NULL,
          is_system_log BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS blog_posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          slug VARCHAR(255) DEFAULT NULL,
          excerpt TEXT,
          content TEXT,
          author_id INT,
          status blog_status DEFAULT 'draft',
          category VARCHAR(50) DEFAULT 'General',
          tags JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INT,
          type notification_type DEFAULT 'info',
          title VARCHAR(200) NOT NULL,
          message TEXT NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          link VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS contacts (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(191) NOT NULL,
          subject VARCHAR(200) NOT NULL,
          message TEXT NOT NULL,
          company VARCHAR(200) DEFAULT NULL,
          phone VARCHAR(50) DEFAULT NULL,
          service VARCHAR(150) DEFAULT NULL,
          timeline VARCHAR(100) DEFAULT NULL,
          reply_message TEXT DEFAULT NULL,
          replied_at VARCHAR(100) DEFAULT NULL,
          notes TEXT DEFAULT NULL,
          status contact_status DEFAULT 'new',
          priority contact_priority DEFAULT 'Medium',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS system_settings (
          setting_key VARCHAR(100) PRIMARY KEY,
          setting_value JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS social_posts (
          id SERIAL PRIMARY KEY,
          blog_id INT DEFAULT NULL,
          platform VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          caption TEXT,
          status VARCHAR(50) DEFAULT 'draft',
          payload TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
      ];

      for (const ddl of ddlStatements) {
        try {
          await this.query(ddl);
        } catch {
          // ignore
        }
      }

      if (useMySQL && mysqlPool && !useEmbeddedStore) {
        const alterColumns = [
          "ALTER TABLE users ADD COLUMN password VARCHAR(255) DEFAULT NULL",
          "ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'pending'",
          "ALTER TABLE users MODIFY COLUMN role VARCHAR(50) DEFAULT 'Developer'",
          "ALTER TABLE users MODIFY COLUMN status VARCHAR(50) DEFAULT 'pending'",
          "ALTER TABLE users ADD COLUMN avatar VARCHAR(255) DEFAULT NULL",
          "ALTER TABLE users ADD COLUMN join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
          "ALTER TABLE projects ADD COLUMN last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
          "ALTER TABLE projects ADD COLUMN repo_url VARCHAR(255) DEFAULT NULL",
          "ALTER TABLE projects ADD COLUMN clientName VARCHAR(150) DEFAULT NULL",
          "ALTER TABLE projects ADD COLUMN assignedDeveloper VARCHAR(100) DEFAULT NULL",
          "ALTER TABLE projects ADD COLUMN assignedViewer VARCHAR(150) DEFAULT NULL",
          "ALTER TABLE projects ADD COLUMN dueDate VARCHAR(50) DEFAULT NULL",
          "ALTER TABLE projects ADD COLUMN updates JSON",
          "ALTER TABLE blog_posts ADD COLUMN slug VARCHAR(255) DEFAULT NULL",
          "ALTER TABLE blog_posts ADD COLUMN category VARCHAR(100) DEFAULT 'Engineering'",
          "ALTER TABLE blog_posts ADD COLUMN tags JSON",
          "ALTER TABLE blog_posts ADD COLUMN author_id INT DEFAULT NULL",
          "ALTER TABLE blog_posts ADD COLUMN author_name VARCHAR(150) DEFAULT NULL",
          "ALTER TABLE blog_posts ADD COLUMN featured_image VARCHAR(500) DEFAULT NULL",
          "ALTER TABLE blog_posts ADD COLUMN read_time INT DEFAULT 5",
          "ALTER TABLE blog_posts ADD COLUMN is_featured BOOLEAN DEFAULT FALSE",
          "ALTER TABLE contacts ADD COLUMN company VARCHAR(200) DEFAULT NULL",
          "ALTER TABLE contacts ADD COLUMN phone VARCHAR(50) DEFAULT NULL",
          "ALTER TABLE contacts ADD COLUMN service VARCHAR(150) DEFAULT NULL",
          "ALTER TABLE contacts ADD COLUMN timeline VARCHAR(100) DEFAULT NULL",
          "ALTER TABLE contacts ADD COLUMN reply_message TEXT DEFAULT NULL",
          "ALTER TABLE contacts ADD COLUMN replied_at VARCHAR(100) DEFAULT NULL",
          "ALTER TABLE contacts ADD COLUMN notes TEXT DEFAULT NULL",
        ];
        for (const alt of alterColumns) {
          try {
            await mysqlPool.query(alt);
          } catch {
            // column already exists
          }
        }
      }

      const adminEmail = process.env.ADMIN_EMAIL || "admin@devinquire.com";
      const adminPass = process.env.ADMIN_PASSWORD || "DevInquire2025!";
      const existing = await this.query(
        "SELECT id, password, status, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [adminEmail],
      );

      if (!existing.rows || existing.rows.length === 0) {
        const hashedPass = await bcrypt.hash(adminPass, 10);
        await this.query(
          "INSERT INTO users (email, password, name, role, status) VALUES ($1, $2, 'DevInquire Admin', 'Admin'::user_role, 'active'::user_status)",
          [adminEmail, hashedPass],
        );
        console.log(`[DB] Default Admin provisioned (${adminEmail}).`);
      } else {
        const adminRow = existing.rows[0];
        if (!adminRow.password || adminRow.status !== "active") {
          const hashedPass =
            adminRow.password || (await bcrypt.hash(adminPass, 10));
          await this.query(
            "UPDATE users SET password = $1, status = 'active'::user_status, role = 'Admin'::user_role WHERE id = $2",
            [hashedPass, adminRow.id],
          );
        }
      }

      // Hydrate system_settings from SQL database into embedded store cache
      try {
        const settingsRes = await this.query(
          "SELECT setting_key, setting_value FROM system_settings",
        );
        if (settingsRes.rows && settingsRes.rows.length > 0) {
          const store = getEmbeddedStore();
          for (const row of settingsRes.rows) {
            if (!row.setting_key || !row.setting_value) continue;
            const parsed =
              typeof row.setting_value === "string"
                ? JSON.parse(row.setting_value)
                : row.setting_value;
            store.settings[row.setting_key] = {
              ...(store.settings[row.setting_key] || {}),
              ...(parsed || {}),
            };
          }
          saveEmbeddedStore();
        }
      } catch {
        // ignore if table is newly created or empty
      }

      console.log("[DB] Schema and Admin verification complete.");
    } catch (err) {
      console.warn("[DB] Bootstrap warning:", err.message);
    }
  },
};

export const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "placeholder",
);

export default db;
