/**
 * Public Router (Used by devinquire.com main site)
 * Exposes public endpoints that do not require admin authentication.
 */
import express from 'express';
import db from '../db.js';
import { sendJsonResponse } from '../utils.js';

const router = express.Router();

const blogListPaths = ['/blog_list', '/blog_list.php'];
const blogDetailPaths = ['/blog_detail', '/blog_detail.php'];

// Public List Blog Posts API
router.get(blogListPaths, async (req, res) => {
    const { category } = req.query;

    try {
        let query = `
            SELECT b.id, b.title, b.excerpt, b.category, b.tags, b.created_at, u.name as author_name 
            FROM blog_posts b 
            LEFT JOIN users u ON b.author_id = u.id 
            WHERE b.status = 'published'
        `;
        const params = [];
        let paramCount = 1;

        if (category) {
            query += ` AND b.category = $${paramCount++}`;
            params.push(category);
        }

        query += ' ORDER BY b.created_at DESC';

        const result = await db.query(query, params);
        const posts = result.rows;

        // Ensure tags are returned as arrays
        for (let post of posts) {
            if (typeof post.tags === 'string') {
                try {
                    post.tags = JSON.parse(post.tags);
                } catch {
                    post.tags = [];
                }
            } else if (!post.tags) {
                post.tags = [];
            }
        }

        return sendJsonResponse(res, "success", "Public blog posts retrieved.", posts);
    } catch (err) {
        console.error("Public Blog List API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve blog posts.", null, 500);
    }
});

// Public Blog Detail API
router.get(blogDetailPaths, async (req, res) => {
    const { id, slug } = req.query;

    if (!id && !slug) {
        return sendJsonResponse(res, "error", "Blog ID or slug is required.", null, 400);
    }

    try {
        let query = `
            SELECT b.*, u.name as author_name 
            FROM blog_posts b 
            LEFT JOIN users u ON b.author_id = u.id 
            WHERE b.status = 'published'
        `;
        const params = [];

        if (id) {
            query += ' AND b.id = $1';
            params.push(id);
        } else if (slug) {
            // Note: If slug column doesn't exist, this might fail, 
            // but we support it to match PHP behavior exactly.
            query += ' AND b.slug = $1';
            params.push(slug);
        }

        const result = await db.query(query, params);
        const post = result.rows[0];

        if (!post) {
            return sendJsonResponse(res, "error", "Blog post not found.", null, 404);
        }

        // Ensure tags are returned as arrays
        if (typeof post.tags === 'string') {
            try {
                post.tags = JSON.parse(post.tags);
            } catch {
                post.tags = [];
            }
        } else if (!post.tags) {
            post.tags = [];
        }

        return sendJsonResponse(res, "success", "Blog post retrieved.", post);
    } catch (err) {
        console.error("Public Blog Detail API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve blog post.", null, 500);
    }
});

export default router;
