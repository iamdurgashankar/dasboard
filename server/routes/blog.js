/**
 * Blog Router
 * Handles listing, creating, updating, deleting, syncing, and configuring blog posts.
 */
import express from "express";
import db from "../db.js";
import {
  sendJsonResponse,
  requireAuth,
  requireMutatingAuth,
  createNotification,
} from "../utils.js";

const router = express.Router();

const listPaths = ["/list", "/list.php"];
const createPaths = ["/create", "/create.php"];
const syncPaths = ["/sync", "/sync.php"];
const updatePaths = ["/update", "/update.php"];
const deletePaths = ["/delete", "/delete.php"];
const configPaths = ["/config", "/config.php"];
const automationStatusPaths = ["/automation/status", "/automation/status.php"];
const automationConfigPaths = ["/automation/config", "/automation/config.php"];
const automationRunPaths = ["/automation/run", "/automation/run.php"];

const DEFAULT_AUTOMATION_CONFIG = {
  enabled: false,
  intervalMinutes: 360,
  autoPublish: true,
  maxPerRun: 10,
  categoryOverride: "Auto",
  lastRunAt: null,
  lastImportedCount: 0,
  lastSkippedCount: 0,
  lastError: null,
};

function slugifyText(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function mapDailyDevCategory(tags = [], title = "", availableCategories = []) {
  const cats = Array.isArray(availableCategories) && availableCategories.length > 0
    ? availableCategories
    : ["Engineering", "Architecture", "AI & Systems", "Cloud & DevOps", "Product Strategy", "Security"];

  const pick = (preferred) => {
    const found = cats.find((c) => c.toLowerCase() === preferred.toLowerCase());
    return found || null;
  };

  const haystack = `${(tags || []).join(" ")} ${title}`.toLowerCase();

  if (/\b(ai|ml|llm|gpt|claude|gemini|openai|anthropic|agent|neural|machine-learning|deep-learning|prompt|rag|copilot)\b/.test(haystack)) {
    return pick("AI & Systems") || cats[0];
  }
  if (/\b(security|cyber|auth|oauth|jwt|xss|cve|vulnerability|encryption|zero-trust|privacy|infosec)\b/.test(haystack)) {
    return pick("Security") || cats[0];
  }
  if (/\b(cloud|devops|kubernetes|k8s|docker|aws|gcp|azure|terraform|ci-cd|linux|serverless|nginx|hosting)\b/.test(haystack)) {
    return pick("Cloud & DevOps") || cats[0];
  }
  if (/\b(architecture|system-design|distributed|microservices|database|postgres|mysql|redis|kafka|scalability|observability|tracing)\b/.test(haystack)) {
    return pick("Architecture") || cats[0];
  }
  if (/\b(product|startup|saas|ux|ui|design|business|growth|marketing|seo|management|leadership)\b/.test(haystack)) {
    return pick("Product Strategy") || cats[0];
  }
  return pick("Engineering") || cats[0];
}

async function runDailyDevAutomation({
  maxPerRun = 10,
  autoPublish = true,
  categoryOverride = "Auto",
  authorId = 1,
} = {}) {
  const blogConfig = db.getSettings("blog_config") || {};
  const availableCategories = Array.isArray(blogConfig.categories) && blogConfig.categories.length > 0
    ? blogConfig.categories
    : ["Engineering", "Architecture", "AI & Systems", "Cloud & DevOps", "Product Strategy", "Security"];

  const count = Math.min(Math.max(Number(maxPerRun) || 10, 1), 25);

  const gqlQuery = {
    query: `query AnonymousFeed($first: Int) {
      page: anonymousFeed(first: $first, ranking: TIME) {
        edges {
          node {
            id
            title
            url
            summary
            image
            createdAt
            tags
            source {
              name
            }
          }
        }
      }
    }`,
    variables: { first: count },
  };

  const response = await fetch("https://api.daily.dev/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "DevInquire-BlogAutomation/1.0",
    },
    body: JSON.stringify(gqlQuery),
  });

  if (!response.ok) {
    throw new Error(`daily.dev API returned HTTP ${response.status}`);
  }

  const json = await response.json();
  const edges = json?.data?.page?.edges || [];
  if (!Array.isArray(edges)) {
    throw new Error("Unexpected response format from daily.dev");
  }

  const existingRes = await db.query("SELECT id, title, slug FROM blog_posts");
  const existingRows = existingRes.rows || [];
  const existingSlugs = new Set(existingRows.map((r) => String(r.slug || "").toLowerCase()));
  const existingTitles = new Set(existingRows.map((r) => String(r.title || "").trim().toLowerCase()));

  const importedPosts = [];
  let skippedCount = 0;

  for (const edge of edges) {
    const node = edge?.node;
    if (!node || !node.title) continue;

    const cleanTitle = String(node.title).trim();
    const slug = slugifyText(cleanTitle) || `daily-dev-${node.id || Date.now()}`;
    if (existingSlugs.has(slug) || existingTitles.has(cleanTitle.toLowerCase())) {
      skippedCount += 1;
      continue;
    }

    const tags = Array.isArray(node.tags) ? node.tags.slice(0, 6) : [];
    const resolvedCategory =
      categoryOverride && categoryOverride !== "Auto"
        ? categoryOverride
        : mapDailyDevCategory(tags, cleanTitle, availableCategories);

    const sourceName = node.source?.name || "daily.dev";
    const summary = String(node.summary || "").trim() || `Latest engineering coverage from ${sourceName} via daily.dev.`;
    const excerpt = summary.length > 220 ? `${summary.slice(0, 217)}...` : summary;
    const content = [
      `## Overview`,
      ``,
      summary,
      ``,
      node.url ? `**Original Source:** [${sourceName}](${node.url})` : `**Source:** ${sourceName}`,
      tags.length > 0 ? `\n**Topics:** ${tags.map((t) => `#${t}`).join(" ")}` : "",
    ]
      .filter((line) => line !== undefined)
      .join("\n");

    const status = autoPublish ? "published" : "draft";
    const authorName = `${sourceName} (via daily.dev)`;
    const tagsJson = JSON.stringify(tags);
    const readTime = Math.max(2, Math.min(8, Math.ceil(summary.split(/\s+/).length / 45)));

    const insertRes = await db.query(
      `INSERT INTO blog_posts (title, excerpt, content, author_id, category, tags, status)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'draft')
       RETURNING id`,
      [
        cleanTitle,
        excerpt,
        content,
        authorId,
        resolvedCategory,
        tagsJson,
        {
          slug,
          author_name: authorName,
          status,
          featured_image: node.image || null,
          read_time: readTime,
          is_featured: false,
        },
      ],
    );

    const postId = insertRes.rows?.[0]?.id;
    if (postId) {
      await db
        .query(
          "UPDATE blog_posts SET slug = $1, author_name = $2, status = $3, featured_image = $4, read_time = $5, is_featured = $6 WHERE id = $7",
          [slug, authorName, status, node.image || null, readTime, 0, postId],
        )
        .catch(() => {});
    }

    existingSlugs.add(slug);
    existingTitles.add(cleanTitle.toLowerCase());
    importedPosts.push({
      id: String(postId || slug),
      title: cleanTitle,
      slug,
      category: resolvedCategory,
      status,
    });
  }

  const nowIso = new Date().toISOString();
  const currentAuto = {
    ...DEFAULT_AUTOMATION_CONFIG,
    ...(db.getSettings("blog_automation") || {}),
  };
  const updatedAuto = db.updateSettings("blog_automation", {
    ...currentAuto,
    lastRunAt: nowIso,
    lastImportedCount: importedPosts.length,
    lastSkippedCount: skippedCount,
    lastError: null,
  });

  if (importedPosts.length > 0) {
    await createNotification(
      null,
      "info",
      "daily.dev Tech News Synced",
      `Imported ${importedPosts.length} new tech article${importedPosts.length === 1 ? "" : "s"} into Blogs (${autoPublish ? "Published" : "Drafts"}).`,
      "/blog",
    ).catch(() => {});
  }

  return {
    importedCount: importedPosts.length,
    skippedCount,
    posts: importedPosts,
    automation: updatedAuto,
  };
}

let automationTimer = null;

function scheduleAutomationTimer() {
  if (automationTimer) {
    clearInterval(automationTimer);
    automationTimer = null;
  }
  const cfg = {
    ...DEFAULT_AUTOMATION_CONFIG,
    ...(db.getSettings("blog_automation") || {}),
  };
  if (cfg.enabled) {
    const mins = Math.max(15, Number(cfg.intervalMinutes) || 360);
    automationTimer = setInterval(() => {
      runDailyDevAutomation({
        maxPerRun: cfg.maxPerRun,
        autoPublish: cfg.autoPublish,
        categoryOverride: cfg.categoryOverride,
      }).catch((err) => {
        console.error("Scheduled daily.dev automation error:", err.message);
        db.updateSettings("blog_automation", {
          ...DEFAULT_AUTOMATION_CONFIG,
          ...(db.getSettings("blog_automation") || {}),
          lastError: err.message,
        });
      });
    }, mins * 60 * 1000);
  }
}

setTimeout(() => {
  try {
    scheduleAutomationTimer();
  } catch {
    // ignore on startup
  }
}, 5000);

// Get Blog Configuration API
router.get(configPaths, requireAuth, async (req, res) => {
  try {
    const config = db.getSettings("blog_config");
    return sendJsonResponse(res, "success", "Blog configuration retrieved.", config);
  } catch (err) {
    console.error("Blog Config Get Error:", err);
    return sendJsonResponse(res, "error", "Failed to load blog configuration.", null, 500);
  }
});

// Update Blog Configuration API (Admin)
router.post(configPaths, requireMutatingAuth, async (req, res) => {
  try {
    const body = req.body || {};
    if (typeof body.categories === "string") {
      body.categories = body.categories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    }
    const updated = db.updateSettings("blog_config", body);
    return sendJsonResponse(res, "success", "Blog configuration saved.", updated);
  } catch (err) {
    console.error("Blog Config Save Error:", err);
    return sendJsonResponse(res, "error", "Failed to save blog configuration.", null, 500);
  }
});

// List Blog Posts API
router.get(listPaths, requireAuth, async (req, res) => {
  try {
    const query = `
            SELECT b.*, COALESCE(b.author_name, u.name, 'DevInquire Editorial') as author_name 
            FROM blog_posts b 
            LEFT JOIN users u ON b.author_id = u.id 
            ORDER BY b.created_at DESC
        `;
    const result = await db.query(query);
    const posts = result.rows || [];

    for (let post of posts) {
      if (typeof post.tags === "string") {
        try {
          post.tags = JSON.parse(post.tags);
        } catch {
          post.tags = [];
        }
      } else if (!post.tags) {
        post.tags = [];
      }
      if (!post.slug && post.title) {
        post.slug = String(post.title)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }
    }

    return sendJsonResponse(res, "success", "Blog posts retrieved.", posts);
  } catch (err) {
    console.error("Blog List API Error:", err);
    return sendJsonResponse(
      res,
      "error",
      "Failed to retrieve blog posts.",
      null,
      500,
    );
  }
});

// Create Blog Post API
router.post(createPaths, requireMutatingAuth, async (req, res) => {
  const {
    title,
    excerpt,
    content,
    category,
    tags,
    status,
    slug,
    author_name,
    featured_image,
    read_time,
    is_featured,
  } = req.body || {};

  const blogConfig = db.getSettings("blog_config");
  const authorId = req.session?.user_id || 1;
  const postCategory =
    category ||
    (Array.isArray(blogConfig.categories) && blogConfig.categories[0]) ||
    "Engineering";
  const postTags = Array.isArray(tags) ? tags : [];
  const initialStatus = status || blogConfig.defaultStatus || "draft";

  if (!title) {
    return sendJsonResponse(res, "error", "Title required for blog post.");
  }

  try {
    const tagsJson = JSON.stringify(postTags);
    const query = `
            INSERT INTO blog_posts (title, excerpt, content, author_id, category, tags, status) 
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'draft') 
            RETURNING id
        `;
    const result = await db.query(query, [
      title,
      excerpt || null,
      content || null,
      authorId,
      postCategory,
      tagsJson,
      {
        slug,
        author_name: author_name || blogConfig.defaultAuthor || "DevInquire Editorial",
        status: initialStatus,
        featured_image: featured_image || null,
        read_time: read_time || 5,
        is_featured: Boolean(is_featured),
      },
    ]);
    const postId = result.rows?.[0]?.id;
    const resolvedSlug =
      slug ||
      String(title)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const resolvedAuthor =
      author_name || blogConfig.defaultAuthor || "DevInquire Editorial";

    if (postId) {
      await db
        .query(
          "UPDATE blog_posts SET slug = $1, author_name = $2, status = $3, featured_image = $4, read_time = $5, is_featured = $6 WHERE id = $7",
          [
            resolvedSlug,
            resolvedAuthor,
            initialStatus,
            featured_image || null,
            read_time || 5,
            Boolean(is_featured) ? 1 : 0,
            postId,
          ],
        )
        .catch(() => {});
    }

    if (initialStatus === "published") {
      await triggerMainSiteSync();
    }

    return sendJsonResponse(res, "success", "Blog post saved.", {
      id: postId,
      slug: resolvedSlug,
    });
  } catch (err) {
    console.error("Blog Create API Error:", err);
    return sendJsonResponse(
      res,
      "error",
      "Failed to save blog post.",
      null,
      500,
    );
  }
});

async function triggerMainSiteSync() {
  const blogConfig = db.getSettings("blog_config");
  if (blogConfig.autoSyncOnPublish === false) {
    return false;
  }
  const baseSite = (blogConfig.siteUrl || "http://localhost:8000").replace(/\/$/, "");
  const token = process.env.SYNC_WEBHOOK_SECRET || "devinquire-secret-token-123";
  const webhookUrl =
    process.env.MAINSITE_SYNC_WEBHOOK_URL ||
    process.env.FRONTEND_WEBHOOK_URL ||
    `${baseSite}/api/sync-posts?token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch(webhookUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Sync Blog Post API (Publish + Webhook trigger)
router.post(syncPaths, requireMutatingAuth, async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return sendJsonResponse(res, "error", "Post ID required for sync.");
  }

  try {
    // 1. Mark as published in dashboard DB FIRST
    const updateQuery =
      "UPDATE blog_posts SET status = 'published' WHERE id = $1";
    await db.query(updateQuery, [id]);

    // 2. Trigger the webhook on main site
    const syncedOk = await triggerMainSiteSync();
    return sendJsonResponse(
      res,
      "success",
      syncedOk
        ? "Article published and synced to live website."
        : "Article published live on Public Blog API and Editorial Ledger.",
    );
  } catch (err) {
    console.error("Blog Sync API Error:", err);
    return sendJsonResponse(res, "error", "Failed to sync article.", null, 500);
  }
});

// Update Blog Post API
router.post(updatePaths, requireMutatingAuth, async (req, res) => {
  const {
    id,
    title,
    excerpt,
    content,
    category,
    tags,
    status,
    slug,
    author_name,
    featured_image,
    read_time,
    is_featured,
  } = req.body || {};

  if (!id) {
    return sendJsonResponse(res, "error", "Post ID required for update.");
  }

  try {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      params.push(title);
    }
    if (excerpt !== undefined) {
      updates.push(`excerpt = $${paramCount++}`);
      params.push(excerpt);
    }
    if (content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      params.push(content);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      params.push(category);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount++}::jsonb`);
      params.push(JSON.stringify(Array.isArray(tags) ? tags : []));
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      params.push(status);
    }
    if (slug !== undefined) {
      updates.push(`slug = $${paramCount++}`);
      params.push(slug);
    }
    if (author_name !== undefined) {
      updates.push(`author_name = $${paramCount++}`);
      params.push(author_name);
    }
    if (featured_image !== undefined) {
      updates.push(`featured_image = $${paramCount++}`);
      params.push(featured_image);
    }
    if (read_time !== undefined) {
      updates.push(`read_time = $${paramCount++}`);
      params.push(read_time);
    }
    if (is_featured !== undefined) {
      updates.push(`is_featured = $${paramCount++}`);
      params.push(Boolean(is_featured));
    }

    if (updates.length === 0) {
      return sendJsonResponse(res, "error", "No update parameters provided.");
    }
    params.push(id);

    const query = `UPDATE blog_posts SET ${updates.join(", ")} WHERE id = $${paramCount}`;
    await db.query(query, params);
    await triggerMainSiteSync();

    return sendJsonResponse(res, "success", "Blog post updated successfully.");
  } catch (err) {
    console.error("Blog Update API Error:", err);
    return sendJsonResponse(
      res,
      "error",
      "Failed to update blog post.",
      null,
      500,
    );
  }
});

// Delete Blog Post API
router.post(deletePaths, requireMutatingAuth, async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return sendJsonResponse(res, "error", "Post ID required for deletion.");
  }

  try {
    const query = "DELETE FROM blog_posts WHERE id = $1";
    await db.query(query, [id]);
    await triggerMainSiteSync();
    return sendJsonResponse(res, "success", "Blog post deleted successfully.");
  } catch (err) {
    console.error("Blog Delete API Error:", err);
    return sendJsonResponse(
      res,
      "error",
      "Failed to delete blog post.",
      null,
      500,
    );
  }
});

// Get Daily.dev Blog Automation Status
router.get(automationStatusPaths, requireAuth, async (req, res) => {
  try {
    const cfg = {
      ...DEFAULT_AUTOMATION_CONFIG,
      ...(db.getSettings("blog_automation") || {}),
    };
    return sendJsonResponse(res, "success", "Blog automation status retrieved.", cfg);
  } catch (err) {
    console.error("Blog Automation Status Error:", err);
    return sendJsonResponse(res, "error", "Failed to load automation status.", null, 500);
  }
});

// Save Daily.dev Blog Automation Workflow Config
router.post(automationConfigPaths, requireMutatingAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const current = {
      ...DEFAULT_AUTOMATION_CONFIG,
      ...(db.getSettings("blog_automation") || {}),
    };
    const nextCfg = {
      ...current,
      enabled: Boolean(body.enabled),
      intervalMinutes: Math.max(15, Number(body.intervalMinutes) || 360),
      autoPublish: body.autoPublish !== undefined ? Boolean(body.autoPublish) : current.autoPublish,
      maxPerRun: Math.min(25, Math.max(1, Number(body.maxPerRun) || current.maxPerRun || 10)),
      categoryOverride: body.categoryOverride || current.categoryOverride || "Auto",
    };
    const updated = db.updateSettings("blog_automation", nextCfg);
    scheduleAutomationTimer();
    return sendJsonResponse(res, "success", "Blog automation workflow saved.", updated);
  } catch (err) {
    console.error("Blog Automation Config Error:", err);
    return sendJsonResponse(res, "error", "Failed to save automation workflow.", null, 500);
  }
});

// Trigger Daily.dev Tech News Sync Immediately
router.post(automationRunPaths, requireMutatingAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const saved = {
      ...DEFAULT_AUTOMATION_CONFIG,
      ...(db.getSettings("blog_automation") || {}),
    };
    const result = await runDailyDevAutomation({
      maxPerRun: body.maxPerRun || saved.maxPerRun || 10,
      autoPublish: body.autoPublish !== undefined ? Boolean(body.autoPublish) : saved.autoPublish,
      categoryOverride: body.categoryOverride || saved.categoryOverride || "Auto",
      authorId: req.session?.user_id || 1,
    });
    return sendJsonResponse(
      res,
      "success",
      `Imported ${result.importedCount} article${result.importedCount === 1 ? "" : "s"} from daily.dev (${result.skippedCount} skipped as duplicates).`,
      result,
    );
  } catch (err) {
    console.error("Blog Automation Run Error:", err);
    const current = {
      ...DEFAULT_AUTOMATION_CONFIG,
      ...(db.getSettings("blog_automation") || {}),
    };
    db.updateSettings("blog_automation", {
      ...current,
      lastError: err.message || "Sync failed",
    });
    return sendJsonResponse(
      res,
      "error",
      `Failed to pull from daily.dev: ${err.message}`,
      null,
      500,
    );
  }
});

export default router;
