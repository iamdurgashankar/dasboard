/**
 * Daily Automated AI Blog Generator & Publisher (Node.js version of cron/generate_blog.php)
 * Runs to create and publish SEO-optimized technical blog posts via Google Gemini API.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const logFile = path.join(__dirname, 'cron.log');

function writeLog(message) {
    const timestamp = `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}]`;
    const logMessage = `${timestamp} ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(message);
}

async function generateAndPublishBlog() {
    writeLog("Starting Automated AI Blog Generation Pipeline...");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        writeLog("ERROR: GEMINI_API_KEY not found in server environment configurations. Aborting.");
        process.exit(1);
    }

    try {
        // 1. Select the next category in round-robin order
        const categories = ['Web Development', 'AI & Machine Learning', 'Design', 'Technology', 'Business'];
        
        const lastPostRes = await db.query("SELECT category FROM blog_posts ORDER BY created_at DESC LIMIT 1");
        const lastCategory = lastPostRes.rows[0] ? lastPostRes.rows[0].category : '';
        
        let nextCategory = 'Web Development';
        if (lastCategory) {
            const index = categories.indexOf(lastCategory);
            if (index !== -1) {
                nextCategory = categories[(index + 1) % categories.length];
            }
        }
        
        writeLog(`Selected Category for today: ${nextCategory} (Previous: ${lastCategory || 'None'})`);

        // 2. Construct Gemini Prompt with Search Grounding
        const prompt = `Search for a top market-trending technical topic in the category: '${nextCategory}' for the year 2026. ` +
                  `Act as a professional tech writer and SEO specialist. Write a comprehensive, high-quality, engaging ` +
                  `technical blog article about it. Keep the content detailed, accurate, and structured with clear markdown headings.\n\n` +
                  `Format the response strictly as a JSON object containing the following keys:\n` +
                  `- 'title': An attention-grabbing, SEO-optimized title.\n` +
                  `- 'excerpt': A concise 1-2 sentence description summarizing the article for SEO search snippets.\n` +
                  `- 'content': The complete article content in Markdown format, with headers, lists, code samples (if applicable), and clear explanations.\n` +
                  `- 'tags': An array of 3-5 relevant lowercase keyword strings (e.g. ['react', 'nextjs', 'seo']).\n` +
                  `- 'meta_title': An SEO-optimized title tag (max 60 characters).\n` +
                  `- 'meta_description': An SEO-optimized meta description (max 160 characters).\n\n` +
                  `CRITICAL: The output must be valid JSON according to RFC 8259. You MUST escape all double quotes within string values as \\\" and all literal newlines as \\n. Do NOT output true control characters or unescaped line breaks inside JSON strings.\n\n` +
                  `Output ONLY the JSON block wrapped inside a markdown code block (like \`\`\`json ... \`\`\`). Do not include any conversational introduction or conclusion.`;

        const model = 'gemini-2.5-flash';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        
        const payload = {
            contents: [
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ],
            tools: [
                { googleSearch: {} }
            ]
        };

        writeLog("Querying Gemini API with Search Grounding for topic details...");
        
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            writeLog(`ERROR: Gemini API call failed. HTTP ${apiResponse.status}: ${errorText}`);
            process.exit(1);
        }

        const resData = await apiResponse.json();
        const text = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!text) {
            writeLog("ERROR: Empty response from Gemini API. Aborting.");
            process.exit(1);
        }

        // Parse the Markdown JSON Block
        let jsonText = text.trim();
        const match = jsonText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
        if (match) {
            jsonText = match[1];
        }

        let blogData;
        try {
            blogData = JSON.parse(jsonText.trim());
        } catch (jsonErr) {
            writeLog(`ERROR: Failed to parse valid blog data from JSON (Error: ${jsonErr.message}). Response text was:\n${text}`);
            process.exit(1);
        }

        if (!blogData || !blogData.title || !blogData.content) {
            writeLog(`ERROR: Parsed JSON missing title or content keys. Response text was:\n${text}`);
            process.exit(1);
        }

        writeLog(`Successfully generated blog: '${blogData.title}'`);

        // 3. Lookup author admin ID from users table
        const adminRes = await db.query("SELECT id FROM users WHERE email = 'admin@devinquire.com' LIMIT 1");
        const authorId = adminRes.rows[0] ? adminRes.rows[0].id : null;
        
        if (!authorId) {
            writeLog("ERROR: Admin author 'admin@devinquire.com' not found in users table. Aborting database save.");
            process.exit(1);
        }

        // 4. Save to database with status 'published'
        const tagsStr = JSON.stringify(blogData.tags || []);
        
        const insertQuery = `
            INSERT INTO blog_posts (title, excerpt, content, author_id, category, tags, status, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
        `;
        const insertRes = await db.query(insertQuery, [
            blogData.title,
            blogData.excerpt || '',
            blogData.content,
            authorId,
            nextCategory,
            tagsStr
        ]);
        
        const postId = insertRes.rows[0].id;
        writeLog(`Successfully saved to dashboard DB (Post ID: ${postId})`);

        // 5. Trigger devinquire.com sync webhook to make it live
        const webhookUrl = process.env.FRONTEND_WEBHOOK_URL || 'http://localhost:8000/api/sync-posts.php?token=devinquire-secret-token-123';
        writeLog(`Triggering devinquire.com sync webhook: ${webhookUrl}`);

        try {
            const syncResponse = await fetch(webhookUrl, {
                method: 'GET',
                signal: AbortSignal.timeout(15000)
            });

            if (syncResponse.ok) {
                const syncText = await syncResponse.text();
                writeLog(`SUCCESS: Webhook sync completed. Response: ${syncText.trim()}`);
            } else {
                writeLog(`WARNING: Webhook sync returned HTTP ${syncResponse.status}. Manual sync required.`);
            }
        } catch (syncErr) {
            writeLog(`WARNING: Webhook sync failed: ${syncErr.message}. Manual sync required.`);
        }

        writeLog("Pipeline completed successfully.");
        process.exit(0);
    } catch (err) {
        writeLog(`FATAL ERROR: ${err.message}\n${err.stack}`);
        process.exit(1);
    }
}

generateAndPublishBlog();
