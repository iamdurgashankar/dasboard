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
} from "../utils.js";

const router = express.Router();

const listPaths = ["/list", "/list.php"];
const createPaths = ["/create", "/create.php"];
const syncPaths = ["/sync", "/sync.php"];
const updatePaths = ["/update", "/update.php"];
const deletePaths = ["/delete", "/delete.php"];
const configPaths = ["/config", "/config.php"];

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
    const blogConfig = db.getSettings("blog_config");
    const baseSite = (blogConfig.siteUrl || "http://localhost:8000").replace(/\/$/, "");
    const token = process.env.SYNC_WEBHOOK_SECRET || "devinquire-secret-token-123";
    const webhookUrl =
      process.env.MAINSITE_SYNC_WEBHOOK_URL ||
      process.env.FRONTEND_WEBHOOK_URL ||
      `${baseSite}/api/sync-posts?token=${encodeURIComponent(token)}`;

    try {
      const response = await fetch(webhookUrl, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        return sendJsonResponse(
          res,
          "success",
          "Article published and synced to live website.",
        );
      } else {
        return sendJsonResponse(
          res,
          "success",
          "Article published live on Public Blog API and Editorial Ledger.",
        );
      }
    } catch {
      return sendJsonResponse(
        res,
        "success",
        "Article published live on Public Blog API and Editorial Ledger.",
      );
    }
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

export default router;
