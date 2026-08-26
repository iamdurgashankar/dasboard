/**
 * Blog Router
 * Handles listing, creating, and syncing blog posts.
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

// List Blog Posts API
router.get(listPaths, requireAuth, async (req, res) => {
  try {
    const query = `
            SELECT b.*, u.name as author_name 
            FROM blog_posts b 
            LEFT JOIN users u ON b.author_id = u.id 
            ORDER BY b.created_at DESC
        `;
    const result = await db.query(query);
    const posts = result.rows;

    // Ensure tags are returned as arrays
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
  const { title, excerpt, content, category, tags } = req.body;
  const authorId = req.session.user_id;
  const postCategory = category || "Engineering";
  const postTags = Array.isArray(tags) ? tags : [];

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
    ]);
    const postId = result.rows[0].id;

    return sendJsonResponse(res, "success", "Blog post draft saved.", {
      id: postId,
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

// Sync Blog Post API (Webhook trigger)
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

    // 2. Trigger the webhook
    const webhookUrl =
      process.env.FRONTEND_WEBHOOK_URL ||
      "http://localhost:8000/api/sync-posts?token=devinquire-secret-token-123";

    console.log(`Triggering blog sync webhook at: ${webhookUrl}`);

    try {
      const response = await fetch(webhookUrl, {
        method: "GET",
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (response.ok) {
        return sendJsonResponse(
          res,
          "success",
          "Article successfully published and synced to devinquire.com.",
        );
      } else {
        const text = await response.text();
        console.error(
          `Webhook deployment failed. HTTP ${response.status}: ${text}`,
        );
        return sendJsonResponse(
          res,
          "success",
          "Article published, but automatic sync failed. Please trigger sync manually.",
          null,
          206,
        );
      }
    } catch (fetchErr) {
      console.error("Webhook fetch failed:", fetchErr.message);
      return sendJsonResponse(
        res,
        "success",
        "Article published, but automatic sync failed (network error). Please trigger sync manually.",
        null,
        206,
      );
    }
  } catch (err) {
    console.error("Blog Sync API Error:", err);
    return sendJsonResponse(res, "error", "Failed to sync article.", null, 500);
  }
});

// Update Blog Post API
router.post(updatePaths, requireMutatingAuth, async (req, res) => {
  const { id, title, excerpt, content, category, tags, status } = req.body;

  if (!id) {
    return sendJsonResponse(res, "error", "Post ID required for update.");
  }

  try {
    // Build dynamic update query based on provided fields
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
