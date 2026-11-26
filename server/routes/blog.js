/**
 * Blog & Omnichannel Editorial Studio Router
 * Handles Blog articles, Instagram & Facebook auto-population, Meta Graph / Webhook
 * publishing, and daily.dev omnichannel content automation.
 */
import crypto from "crypto";
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

// Social Studio & Omnichannel Automation paths
const socialListPaths = ["/social/list", "/social/list.php"];
const socialSavePaths = ["/social/save", "/social/save.php"];
const socialDeletePaths = ["/social/delete", "/social/delete.php"];
const socialPublishPaths = ["/social/publish", "/social/publish.php"];
const socialPopulateAllPaths = ["/social/populate-all", "/social/populate-all.php"];
const socialConfigPaths = ["/social/config", "/social/config.php"];
const socialOAuthUrlPaths = ["/social/oauth/url", "/social/oauth/url.php"];
const socialOAuthCallbackPaths = ["/social/oauth/callback", "/social/oauth/callback.php"];
const socialDiscoverPaths = ["/social/discover", "/social/discover.php"];
const socialSelectPagePaths = ["/social/select-page", "/social/select-page.php"];
const socialVerifyPaths = ["/social/verify", "/social/verify.php"];
const socialDisconnectPaths = ["/social/disconnect", "/social/disconnect.php"];

const OAUTH_STATE_SECRET =
  process.env.SESSION_SECRET ||
  process.env.JWT_SECRET ||
  "devinquire-meta-oauth-state-secret-2026";

function createOAuthState(data = {}) {
  const payload = {
    ...data,
    nonce: crypto.randomBytes(8).toString("hex"),
    exp: Date.now() + 20 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyOAuthState(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return null;
    const expected = crypto
      .createHmac("sha256", OAUTH_STATE_SECRET)
      .update(encoded)
      .digest("base64url");
    if (sig !== expected) return null;
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed || (parsed.exp && Date.now() > parsed.exp)) return null;
    return parsed;
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_AUTOMATION_CONFIG = {
  enabled: false,
  intervalMinutes: 360,
  autoPublish: true,
  maxPerRun: 10,
  categoryOverride: "Auto",
  autoPopulateSocial: true,
  lastRunAt: null,
  lastImportedCount: 0,
  lastSkippedCount: 0,
  lastSocialCount: 0,
  lastError: null,
};

const DEFAULT_SOCIAL_CONFIG = {
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
  metaConfigId: process.env.META_LOGIN_CONFIG_ID || "",
  oauthScopeMode: "instagram_and_facebook",
  includeBusinessManagement: false,
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
};

function slugifyText(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function stripMarkdown(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeHashtag(tag) {
  const cleaned = String(tag || "")
    .trim()
    .replace(/^#+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "");
  return cleaned || null;
}

function buildHashtags(blogTags = [], category = "", defaultHashtags = []) {
  const seen = new Set();
  const result = [];
  const pushTag = (raw) => {
    const clean = normalizeHashtag(raw);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  };

  if (category) pushTag(category);
  (Array.isArray(blogTags) ? blogTags : []).forEach(pushTag);
  (Array.isArray(defaultHashtags) ? defaultHashtags : []).forEach(pushTag);

  return result.slice(0, 10);
}

export async function ensureSocialPostsTable() {
  await db
    .query(`
      CREATE TABLE IF NOT EXISTS social_posts (
        id SERIAL PRIMARY KEY,
        blog_id INT DEFAULT NULL,
        platform VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        caption TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        payload TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    .catch(() => {});
}

async function loadSocialConfig() {
  const fallback = {
    ...DEFAULT_SOCIAL_CONFIG,
    ...(db.getSettings("social_config") || {}),
  };
  try {
    const res = await db.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1",
      ["social_config"]
    );
    const row = res.rows?.[0];
    if (row && row.setting_value) {
      const parsed =
        typeof row.setting_value === "string"
          ? JSON.parse(row.setting_value)
          : row.setting_value;
      const merged = {
        ...DEFAULT_SOCIAL_CONFIG,
        ...fallback,
        ...(parsed || {}),
      };
      db.updateSettings("social_config", merged);
      return merged;
    }
  } catch {
    // fallback to embedded settings
  }
  return fallback;
}

async function saveSocialConfig(patch = {}) {
  const current = await loadSocialConfig();
  const merged = {
    ...DEFAULT_SOCIAL_CONFIG,
    ...current,
    ...(patch || {}),
  };
  db.updateSettings("social_config", merged);
  const jsonStr = JSON.stringify(merged);
  try {
    const check = await db.query(
      "SELECT setting_key FROM system_settings WHERE setting_key = $1 LIMIT 1",
      ["social_config"]
    );
    if (check.rows && check.rows.length > 0) {
      await db.query(
        "UPDATE system_settings SET setting_value = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $2",
        [jsonStr, "social_config"]
      );
    } else {
      await db.query(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ($1, $2::jsonb)",
        ["social_config", jsonStr]
      );
    }
  } catch {
    // db.updateSettings already persisted to fallback store
  }
  return merged;
}

function parseSocialRow(row) {
  let parsed = {};
  try {
    parsed =
      typeof row.payload === "string"
        ? JSON.parse(row.payload)
        : row.payload || {};
  } catch {
    parsed = {};
  }
  return {
    ...parsed,
    id: String(row.id),
    blogId:
      row.blog_id !== null && row.blog_id !== undefined
        ? String(row.blog_id)
        : parsed.blogId || null,
    platform: row.platform || parsed.platform || "instagram",
    title: row.title || parsed.title || "",
    caption: row.caption ?? parsed.caption ?? "",
    status: row.status || parsed.status || "draft",
    createdAt: row.created_at || parsed.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || parsed.updatedAt || row.created_at || new Date().toISOString(),
  };
}

function buildSocialPayloadFromBlog(blog, platform, socialCfg, blogCfg, overrides = {}) {
  const baseSite = String(blogCfg?.siteUrl || "https://devinquire.com")
    .replace(/\/$/, "");
  const cleanSite = baseSite.includes("localhost")
    ? "https://devinquire.com"
    : baseSite;
  const slug = blog.slug || slugifyText(blog.title || `post-${blog.id || Date.now()}`);
  const articleUrl = `${cleanSite}/blog/${slug}`;

  const rawTags =
    typeof blog.tags === "string"
      ? (() => {
          try {
            return JSON.parse(blog.tags);
          } catch {
            return [];
          }
        })()
      : Array.isArray(blog.tags)
      ? blog.tags
      : [];

  const hashtags = Array.isArray(overrides.hashtags)
    ? overrides.hashtags.map(normalizeHashtag).filter(Boolean)
    : buildHashtags(rawTags, blog.category, socialCfg.defaultHashtags);

  const hashtagLine = hashtags.map((h) => `#${h}`).join(" ");
  const plainBody = stripMarkdown(blog.content || "");
  const excerpt = String(blog.excerpt || "").trim();
  const cta = String(
    socialCfg.ctaTemplate || "Read the full engineering breakdown:"
  ).trim();

  let generatedCaption = "";
  if (platform === "instagram") {
    const bodySnippet =
      plainBody && plainBody !== excerpt
        ? plainBody.slice(0, 520) + (plainBody.length > 520 ? "…" : "")
        : "";
    generatedCaption = [
      `🚀 ${blog.title}`,
      excerpt ? `\n${excerpt}` : "",
      bodySnippet ? `\n${bodySnippet}` : "",
      `\n🔗 ${cta} ${articleUrl}`,
      hashtagLine ? `\n${hashtagLine}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else {
    const bodySnippet =
      plainBody && plainBody !== excerpt
        ? plainBody.slice(0, 850) + (plainBody.length > 850 ? "…" : "")
        : "";
    generatedCaption = [
      `${blog.title}`,
      excerpt ? `\n${excerpt}` : "",
      bodySnippet ? `\n${bodySnippet}` : "",
      `\n${cta}\n${articleUrl}`,
      hashtagLine ? `\n${hashtagLine}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const finalCaption =
    overrides.caption && String(overrides.caption).trim()
      ? String(overrides.caption).trim()
      : generatedCaption;

  const imageUrl =
    overrides.imageUrl !== undefined
      ? overrides.imageUrl
      : blog.featured_image || "";

  return {
    platform,
    blogId: blog.id ? String(blog.id) : null,
    blogSlug: slug,
    title: String(blog.title || "").trim(),
    excerpt: excerpt || plainBody.slice(0, 200),
    caption: finalCaption,
    hashtags,
    imageUrl: imageUrl || "",
    articleUrl,
    category: blog.category || "Engineering",
    authorName:
      blog.author_name || blogCfg?.defaultAuthor || "DevInquire Editorial",
    accountHandle:
      platform === "instagram"
        ? socialCfg.instagramHandle || "@devinquire"
        : socialCfg.facebookPageName || "DevInquire",
    customEdited: Boolean(overrides.customEdited),
  };
}

async function dispatchToExternalSocial(socialPost, socialCfg) {
  const results = {
    dispatched: false,
    notConfigured: false,
    deliveryChannel: "studio_feed",
    externalPostId: socialPost.externalPostId || null,
    externalUrl: socialPost.externalUrl || null,
    publishedAt: new Date().toISOString(),
    error: null,
  };

  const hasWebhook = Boolean(socialCfg.webhookUrl && String(socialCfg.webhookUrl).trim());
  const hasFbCreds = Boolean(socialCfg.facebookPageId && socialCfg.facebookAccessToken);
  const hasIgCreds = Boolean(socialCfg.instagramAccountId && socialCfg.instagramAccessToken);

  if (socialPost.platform === "facebook" && !hasFbCreds && !hasWebhook) {
    results.notConfigured = true;
    results.error =
      "Facebook Page is not connected yet. Click 'Connect IG & FB' to connect your Facebook Page.";
    return results;
  }

  if (socialPost.platform === "instagram" && !hasIgCreds && !hasWebhook) {
    results.notConfigured = true;
    results.error = hasFbCreds
      ? "Facebook Page is connected, but no Instagram Business account is linked to this Page. In Facebook Page → Settings → Linked Accounts, link your Instagram Professional account, then reconnect."
      : "Instagram Business account is not connected yet. Click 'Connect IG & FB' to connect.";
    return results;
  }

  // 1. Direct Meta Graph API Publishing
  try {
    if (socialPost.platform === "facebook" && hasFbCreds) {
      const pageId = encodeURIComponent(socialCfg.facebookPageId);
      let fbSuccessId = null;
      let fbErr = null;

      // Try photo post first if a valid public HTTPS image URL was provided
      if (socialPost.imageUrl && /^https:\/\//i.test(socialPost.imageUrl)) {
        const photoRes = await fetch(
          `https://graph.facebook.com/v21.0/${pageId}/photos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: socialPost.imageUrl,
              caption: socialPost.caption,
              published: true,
              access_token: socialCfg.facebookAccessToken,
            }),
            signal: AbortSignal.timeout(15000),
          }
        );
        const photoJson = await photoRes.json().catch(() => ({}));
        if (photoRes.ok && (photoJson.post_id || photoJson.id)) {
          fbSuccessId = photoJson.post_id || photoJson.id;
        } else {
          fbErr = photoJson?.error?.message;
        }
      }

      // Feed post (or fallback if photo URL couldn't be fetched by Meta)
      if (!fbSuccessId) {
        const feedEndpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`;
        const feedRes = await fetch(feedEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: socialPost.caption,
            link: socialPost.articleUrl || undefined,
            access_token: socialCfg.facebookAccessToken,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const feedJson = await feedRes.json().catch(() => ({}));
        if (feedRes.ok && feedJson.id) {
          fbSuccessId = feedJson.id;
        } else {
          // Final fallback: post message without link attachment if link scrape failed
          const msgOnlyRes = await fetch(feedEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: socialPost.caption,
              access_token: socialCfg.facebookAccessToken,
            }),
            signal: AbortSignal.timeout(15000),
          });
          const msgOnlyJson = await msgOnlyRes.json().catch(() => ({}));
          if (msgOnlyRes.ok && msgOnlyJson.id) {
            fbSuccessId = msgOnlyJson.id;
          } else {
            fbErr =
              msgOnlyJson?.error?.message ||
              feedJson?.error?.message ||
              fbErr ||
              `Facebook Graph API HTTP ${feedRes.status}`;
          }
        }
      }

      if (fbSuccessId) {
        results.dispatched = true;
        results.deliveryChannel = "meta_graph_api";
        results.externalPostId = fbSuccessId;
        results.externalUrl = `https://www.facebook.com/${fbSuccessId}`;
        results.error = null;
      } else {
        results.error = fbErr || "Facebook Graph API rejected the post.";
      }
    } else if (socialPost.platform === "instagram" && hasIgCreds) {
      const resolvedImageUrl =
        socialPost.imageUrl && /^https:\/\//i.test(socialPost.imageUrl)
          ? socialPost.imageUrl
          : socialCfg.defaultSocialImageUrl ||
            "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1080&q=80";

      const igBase = `https://graph.facebook.com/v21.0/${encodeURIComponent(
        socialCfg.instagramAccountId
      )}`;

      const containerRes = await fetch(`${igBase}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: resolvedImageUrl,
          caption: socialPost.caption,
          access_token: socialCfg.instagramAccessToken,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const containerJson = await containerRes.json().catch(() => ({}));

      if (containerRes.ok && containerJson.id) {
        const creationId = containerJson.id;
        let containerFailed = null;

        // Poll Instagram container status until FINISHED (avoids error 9007 "Media ID is not available")
        for (let attempt = 0; attempt < 8; attempt++) {
          await sleep(2000);
          try {
            const stRes = await fetch(
              `https://graph.facebook.com/v21.0/${encodeURIComponent(
                creationId
              )}?fields=status_code,status&access_token=${encodeURIComponent(
                socialCfg.instagramAccessToken
              )}`,
              { signal: AbortSignal.timeout(8000) }
            );
            const stJson = await stRes.json().catch(() => ({}));
            const code = String(stJson.status_code || "").toUpperCase();
            if (!code || code === "FINISHED") {
              break;
            }
            if (code === "ERROR" || code === "EXPIRED") {
              containerFailed =
                stJson.status ||
                `Instagram media processing failed (${code}). Ensure image URL is a public JPEG/PNG.`;
              break;
            }
          } catch {
            break;
          }
        }

        if (containerFailed) {
          results.error = containerFailed;
        } else {
          let publishRes = await fetch(`${igBase}/media_publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              creation_id: creationId,
              access_token: socialCfg.instagramAccessToken,
            }),
            signal: AbortSignal.timeout(15000),
          });
          let publishJson = await publishRes.json().catch(() => ({}));

          // One extra retry if IG container needed a couple more seconds
          if (!publishRes.ok && publishJson?.error?.code === 9007) {
            await sleep(3000);
            publishRes = await fetch(`${igBase}/media_publish`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                creation_id: creationId,
                access_token: socialCfg.instagramAccessToken,
              }),
              signal: AbortSignal.timeout(15000),
            });
            publishJson = await publishRes.json().catch(() => ({}));
          }

          if (publishRes.ok && publishJson.id) {
            results.dispatched = true;
            results.deliveryChannel = "meta_graph_api";
            results.externalPostId = publishJson.id;
            results.error = null;
            try {
              const permRes = await fetch(
                `https://graph.facebook.com/v21.0/${encodeURIComponent(
                  publishJson.id
                )}?fields=permalink&access_token=${encodeURIComponent(
                  socialCfg.instagramAccessToken
                )}`,
                { signal: AbortSignal.timeout(6000) }
              );
              const permJson = await permRes.json().catch(() => ({}));
              if (permJson.permalink) results.externalUrl = permJson.permalink;
            } catch {
              // permalink optional
            }
          } else {
            results.error =
              publishJson?.error?.message ||
              `Instagram Publish API HTTP ${publishRes.status}`;
          }
        }
      } else {
        results.error =
          containerJson?.error?.message ||
          `Instagram Media API HTTP ${containerRes.status}`;
      }
    }
  } catch (err) {
    results.error = err.message || "Meta Graph API request failed";
  }

  // 2. Omnichannel Webhook Automation (Make / Zapier / n8n / Custom)
  if (hasWebhook) {
    try {
      const whRes = await fetch(String(socialCfg.webhookUrl).trim(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "DevInquire-OmnichannelStudio/1.0",
        },
        body: JSON.stringify({
          event: "editorial.social.publish",
          platform: socialPost.platform,
          post: socialPost,
          timestamp: results.publishedAt,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (whRes.ok) {
        results.dispatched = true;
        results.error = null;
        results.deliveryChannel =
          results.deliveryChannel === "meta_graph_api"
            ? "meta_graph_api+webhook"
            : "webhook_automation";
      } else if (!results.dispatched && !results.error) {
        results.error = `Automation Webhook HTTP ${whRes.status}`;
      }
    } catch (err) {
      if (!results.dispatched && !results.error) {
        results.error = `Webhook error: ${err.message}`;
      }
    }
  }

  return results;
}

async function upsertSocialPostForBlog(blog, platform, options = {}) {
  await ensureSocialPostsTable();
  const blogCfg = db.getSettings("blog_config") || {};
  const socialCfg = await loadSocialConfig();

  const existingRes = blog.id
    ? await db.query(
        "SELECT id, blog_id, platform, title, caption, status, payload, created_at, updated_at FROM social_posts WHERE blog_id = $1 AND platform = $2 LIMIT 1",
        [blog.id, platform]
      )
    : { rows: [] };
  const existingRow = existingRes.rows && existingRes.rows[0];
  const existingParsed = existingRow ? parseSocialRow(existingRow) : null;

  const hasExplicitOverride = Boolean(
    options.caption && String(options.caption).trim()
  );

  // Preserve custom user edits on automatic blog updates unless forceOverwrite is set
  const preserveCaption =
    existingParsed &&
    existingParsed.customEdited &&
    !options.forceOverwrite &&
    !hasExplicitOverride
      ? existingParsed.caption
      : options.caption;

  const built = buildSocialPayloadFromBlog(blog, platform, socialCfg, blogCfg, {
    caption: preserveCaption,
    hashtags: options.hashtags,
    imageUrl:
      options.imageUrl !== undefined && options.imageUrl !== ""
        ? options.imageUrl
        : existingParsed?.imageUrl || blog.featured_image || "",
    customEdited:
      hasExplicitOverride ||
      Boolean(existingParsed?.customEdited && !options.forceOverwrite),
  });

  const shouldAttemptExternalPublish =
    options.forcePublish ||
    (blog.status === "published" && socialCfg.autoPublishOnBlogPublish !== false);

  let nextStatus = existingParsed?.status === "published" ? "published" : "draft";
  let dispatchInfo = {
    dispatched: Boolean(existingParsed?.externalPostId),
    deliveryChannel: existingParsed?.deliveryChannel || "studio_feed",
    externalPostId: existingParsed?.externalPostId || null,
    externalUrl: existingParsed?.externalUrl || null,
    publishedAt: existingParsed?.publishedAt || null,
    lastDispatchError: existingParsed?.lastDispatchError || null,
  };

  // Avoid duplicate re-posting to Meta if already externally published unless forceRepublish is true
  const alreadyExternallyPublished = Boolean(
    existingParsed?.externalPostId && existingParsed?.status === "published"
  );

  if (
    shouldAttemptExternalPublish &&
    (!alreadyExternallyPublished || options.forceRepublish)
  ) {
    const dispatched = await dispatchToExternalSocial(built, socialCfg);
    if (dispatched.dispatched) {
      nextStatus = "published";
      dispatchInfo = {
        dispatched: true,
        deliveryChannel: dispatched.deliveryChannel,
        externalPostId: dispatched.externalPostId,
        externalUrl: dispatched.externalUrl,
        publishedAt: dispatched.publishedAt,
        lastDispatchError: null,
      };
    } else {
      // Keep as draft if external publish failed or account isn't connected yet so user sees exact status
      nextStatus = "draft";
      dispatchInfo = {
        dispatched: false,
        deliveryChannel: "studio_feed",
        externalPostId: existingParsed?.externalPostId || null,
        externalUrl: existingParsed?.externalUrl || null,
        publishedAt: existingParsed?.publishedAt || null,
        lastDispatchError: dispatched.error,
      };
      if (dispatched.error && !dispatched.notConfigured) {
        await saveSocialConfig({ lastDispatchError: dispatched.error });
      }
    }
  }

  const payloadObj = {
    ...(existingParsed || {}),
    ...built,
    status: nextStatus,
    ...dispatchInfo,
    updatedAt: new Date().toISOString(),
  };
  const payloadStr = JSON.stringify(payloadObj);

  let savedId;
  if (existingRow) {
    savedId = existingRow.id;
    await db.query(
      "UPDATE social_posts SET title = $1, caption = $2, status = $3, payload = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5",
      [built.title, built.caption, nextStatus, payloadStr, savedId]
    );
  } else {
    const ins = await db.query(
      "INSERT INTO social_posts (blog_id, platform, title, caption, status, payload) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [blog.id || null, platform, built.title, built.caption, nextStatus, payloadStr]
    );
    savedId = ins.rows?.[0]?.id;
  }

  return {
    ...payloadObj,
    id: String(savedId || existingRow?.id || Date.now()),
  };
}

async function syncBlogToSocialChannels(blog, socialOptions = {}) {
  const socialCfg = await loadSocialConfig();

  const doInstagram =
    socialOptions.enableInstagram !== undefined
      ? Boolean(socialOptions.enableInstagram)
      : Boolean(socialCfg.autoPopulateInstagram);
  const doFacebook =
    socialOptions.enableFacebook !== undefined
      ? Boolean(socialOptions.enableFacebook)
      : Boolean(socialCfg.autoPopulateFacebook);

  const synced = [];
  if (doInstagram) {
    const ig = await upsertSocialPostForBlog(blog, "instagram", {
      caption: socialOptions.instagramCaption,
      imageUrl: socialOptions.imageUrl ?? blog.featured_image,
      forceOverwrite: Boolean(socialOptions.forceOverwrite),
      forcePublish: Boolean(socialOptions.forcePublish),
      forceRepublish: Boolean(socialOptions.forceRepublish),
    });
    synced.push(ig);
  }
  if (doFacebook) {
    const fb = await upsertSocialPostForBlog(blog, "facebook", {
      caption: socialOptions.facebookCaption,
      imageUrl: socialOptions.imageUrl ?? blog.featured_image,
      forceOverwrite: Boolean(socialOptions.forceOverwrite),
      forcePublish: Boolean(socialOptions.forcePublish),
      forceRepublish: Boolean(socialOptions.forceRepublish),
    });
    synced.push(fb);
  }

  if (synced.length > 0) {
    await saveSocialConfig({
      lastSyncAt: new Date().toISOString(),
      lastSyncedCount: synced.length,
    });
  }

  return synced;
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
  autoPopulateSocial = true,
  authorId = 1,
} = {}) {
  const blogConfig = db.getSettings("blog_config") || {};
  const socialCfg = {
    ...DEFAULT_SOCIAL_CONFIG,
    ...(db.getSettings("social_config") || {}),
  };
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
  let socialGeneratedCount = 0;

  const shouldSyncSocial =
    autoPopulateSocial !== false && socialCfg.autoPopulateDailyDev !== false;

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
      ]
    );

    const postId = insertRes.rows?.[0]?.id;
    if (postId) {
      await db
        .query(
          "UPDATE blog_posts SET slug = $1, author_name = $2, status = $3, featured_image = $4, read_time = $5, is_featured = $6 WHERE id = $7",
          [slug, authorName, status, node.image || null, readTime, 0, postId]
        )
        .catch(() => {});

      if (shouldSyncSocial) {
        const socialItems = await syncBlogToSocialChannels({
          id: postId,
          title: cleanTitle,
          slug,
          excerpt,
          content,
          category: resolvedCategory,
          tags,
          status,
          author_name: authorName,
          featured_image: node.image || null,
        });
        socialGeneratedCount += socialItems.length;
      }
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
    lastSocialCount: socialGeneratedCount,
    lastError: null,
  });

  if (importedPosts.length > 0) {
    await createNotification(
      null,
      "info",
      "Omnichannel Content Synced",
      `Imported ${importedPosts.length} blog article${importedPosts.length === 1 ? "" : "s"} and populated ${socialGeneratedCount} Instagram & Facebook post${socialGeneratedCount === 1 ? "" : "s"}.`,
      "/blogs"
    ).catch(() => {});
  }

  return {
    importedCount: importedPosts.length,
    skippedCount,
    socialGeneratedCount,
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
        autoPopulateSocial: cfg.autoPopulateSocial !== false,
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
      500
    );
  }
});

// Create Blog Post API (also auto-populates Instagram & Facebook)
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
    socialOptions,
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
          ]
        )
        .catch(() => {});
    }

    const socialPosts = await syncBlogToSocialChannels(
      {
        id: postId,
        title,
        slug: resolvedSlug,
        excerpt: excerpt || "",
        content: content || "",
        category: postCategory,
        tags: postTags,
        status: initialStatus,
        author_name: resolvedAuthor,
        featured_image: featured_image || null,
      },
      socialOptions || {}
    );

    if (initialStatus === "published") {
      await triggerMainSiteSync();
    }

    const liveDispatched = socialPosts.filter((sp) => sp.status === "published" && sp.dispatched);
    const socialErrors = socialPosts
      .filter((sp) => sp.lastDispatchError)
      .map((sp) => `${sp.platform === "instagram" ? "IG" : "FB"}: ${sp.lastDispatchError}`);

    const createMsg =
      initialStatus === "published"
        ? liveDispatched.length > 0 && socialErrors.length === 0
          ? `Published to Website Blog + Live on ${liveDispatched
              .map((s) => (s.platform === "instagram" ? "Instagram" : "Facebook"))
              .join(" & ")}!`
          : socialErrors.length > 0
          ? `Blog published live. Social status: ${socialErrors.join(" | ")}`
          : "Blog published and social drafts populated."
        : "Blog draft saved and social posts populated.";

    return sendJsonResponse(res, "success", createMsg, {
      id: postId,
      slug: resolvedSlug,
      socialPosts,
      socialWarnings: socialErrors,
    });
  } catch (err) {
    console.error("Blog Create API Error:", err);
    return sendJsonResponse(
      res,
      "error",
      "Failed to save blog post.",
      null,
      500
    );
  }
});

async function triggerMainSiteSync() {
  const blogConfig = db.getSettings("blog_config");
  if (blogConfig.autoSyncOnPublish === false) {
    return false;
  }
  const baseSite = (blogConfig.siteUrl || "https://devinquire.com").replace(/\/$/, "");
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

// Sync Blog Post API (Publish + Website Webhook + Instagram & Facebook Sync)
router.post(syncPaths, requireMutatingAuth, async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return sendJsonResponse(res, "error", "Post ID required for sync.");
  }

  try {
    await db.query("UPDATE blog_posts SET status = 'published' WHERE id = $1", [id]);

    // Fetch updated blog row to sync & publish to Instagram and Facebook
    const postRes = await db.query("SELECT * FROM blog_posts WHERE id = $1 LIMIT 1", [id]);
    const blogRow = postRes.rows?.[0];
    let socialSynced = [];
    if (blogRow) {
      socialSynced = await syncBlogToSocialChannels(
        { ...blogRow, status: "published" },
        { forcePublish: true }
      );
    }

    const syncedOk = await triggerMainSiteSync();
    const liveSocial = socialSynced.filter((sp) => sp.status === "published" && sp.dispatched);
    const socialErrors = socialSynced
      .filter((sp) => sp.lastDispatchError)
      .map((sp) => `${sp.platform === "instagram" ? "IG" : "FB"}: ${sp.lastDispatchError}`);

    let syncMsg = syncedOk
      ? "Article published to live website"
      : "Article published on Editorial Ledger";

    if (liveSocial.length > 0) {
      syncMsg += ` + published live on ${liveSocial
        .map((s) => (s.platform === "instagram" ? "Instagram" : "Facebook"))
        .join(" & ")}!`;
    }
    if (socialErrors.length > 0) {
      syncMsg += ` (Social note: ${socialErrors.join(" | ")})`;
    }

    return sendJsonResponse(res, "success", syncMsg, {
      socialPosts: socialSynced,
      socialWarnings: socialErrors,
    });
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
    socialOptions,
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

    const socialCfg = await loadSocialConfig();

    let socialPosts = [];
    if (socialCfg.autoSyncOnBlogUpdate !== false || socialOptions) {
      const updatedRes = await db.query("SELECT * FROM blog_posts WHERE id = $1 LIMIT 1", [id]);
      const updatedBlog = updatedRes.rows?.[0];
      if (updatedBlog) {
        socialPosts = await syncBlogToSocialChannels(updatedBlog, socialOptions || {});
      }
    }

    await triggerMainSiteSync();

    return sendJsonResponse(res, "success", "Blog post updated successfully.", {
      socialPosts,
    });
  } catch (err) {
    console.error("Blog Update API Error:", err);
    return sendJsonResponse(
      res,
      "error",
      "Failed to update blog post.",
      null,
      500
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
    await ensureSocialPostsTable();
    await db.query("DELETE FROM blog_posts WHERE id = $1", [id]);
    await db.query("DELETE FROM social_posts WHERE blog_id = $1", [id]).catch(() => {});
    await triggerMainSiteSync();
    return sendJsonResponse(res, "success", "Blog post and linked social posts deleted.");
  } catch (err) {
    console.error("Blog Delete API Error:", err);
    return sendJsonResponse(
      res,
      "error",
      "Failed to delete blog post.",
      null,
      500
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
      autoPopulateSocial:
        body.autoPopulateSocial !== undefined
          ? Boolean(body.autoPopulateSocial)
          : current.autoPopulateSocial !== false,
    };
    const updated = db.updateSettings("blog_automation", nextCfg);
    scheduleAutomationTimer();
    return sendJsonResponse(res, "success", "Omnichannel automation workflow saved.", updated);
  } catch (err) {
    console.error("Blog Automation Config Error:", err);
    return sendJsonResponse(res, "error", "Failed to save automation workflow.", null, 500);
  }
});

// Trigger Daily.dev Tech News Sync Immediately (Blog + Instagram + Facebook)
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
      autoPopulateSocial:
        body.autoPopulateSocial !== undefined
          ? Boolean(body.autoPopulateSocial)
          : saved.autoPopulateSocial !== false,
      authorId: req.session?.user_id || 1,
    });
    return sendJsonResponse(
      res,
      "success",
      `Imported ${result.importedCount} article${result.importedCount === 1 ? "" : "s"} & populated ${result.socialGeneratedCount} Instagram/Facebook post${result.socialGeneratedCount === 1 ? "" : "s"} (${result.skippedCount} duplicates skipped).`,
      result
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
      500
    );
  }
});

/* ============================================================
 *  Instagram & Facebook Omnichannel Studio Endpoints
 * ============================================================ */

// List Social Posts (Instagram & Facebook)
router.get(socialListPaths, requireAuth, async (req, res) => {
  try {
    await ensureSocialPostsTable();
    const platform = req.query?.platform
      ? String(req.query.platform).trim().toLowerCase()
      : null;

    const result = platform
      ? await db.query(
          "SELECT id, blog_id, platform, title, caption, status, payload, created_at, updated_at FROM social_posts WHERE platform = $1 ORDER BY updated_at DESC",
          [platform]
        )
      : await db.query(
          "SELECT id, blog_id, platform, title, caption, status, payload, created_at, updated_at FROM social_posts ORDER BY updated_at DESC"
        );

    const items = (result.rows || []).map(parseSocialRow);
    return sendJsonResponse(res, "success", "Social posts retrieved.", items);
  } catch (err) {
    console.error("Social List API Error:", err);
    return sendJsonResponse(res, "error", "Failed to retrieve social posts.", null, 500);
  }
});

// Create or Update Social Post (or Cross-Post to Instagram + Facebook)
router.post(socialSavePaths, requireMutatingAuth, async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || "").trim();
  const caption = String(body.caption || "").trim();

  if (!title && !caption) {
    return sendJsonResponse(res, "error", "Title or caption is required.", null, 400);
  }

  try {
    await ensureSocialPostsTable();
    const socialCfg = await loadSocialConfig();
    const blogCfg = db.getSettings("blog_config") || {};
    const targetPlatforms = Array.isArray(body.platforms) && body.platforms.length > 0
      ? body.platforms.map((p) => String(p).toLowerCase())
      : [String(body.platform || "instagram").toLowerCase()];

    const savedPosts = [];
    const dispatchErrors = [];

    for (const plt of targetPlatforms) {
      if (plt !== "instagram" && plt !== "facebook") continue;

      const hashtags = Array.isArray(body.hashtags)
        ? body.hashtags.map(normalizeHashtag).filter(Boolean)
        : typeof body.hashtags === "string"
        ? body.hashtags
            .split(/[\s,]+/)
            .map(normalizeHashtag)
            .filter(Boolean)
        : buildHashtags([], body.category || "Engineering", socialCfg.defaultHashtags);

      let finalStatus = body.status === "published" && !body.publishNow ? "published" : "draft";
      const existingId = targetPlatforms.length === 1 && body.id ? body.id : null;

      let existingParsed = {};
      if (existingId) {
        const existingRes = await db.query(
          "SELECT id, blog_id, platform, title, caption, status, payload, created_at, updated_at FROM social_posts WHERE id = $1 LIMIT 1",
          [existingId]
        );
        if (existingRes.rows?.[0]) {
          existingParsed = parseSocialRow(existingRes.rows[0]);
        }
      }

      const resolvedTitle = title || caption.split("\n")[0].slice(0, 120) || "Social Post";
      const baseSite = String(blogCfg.siteUrl || "https://devinquire.com").replace(/\/$/, "");
      const cleanSite = baseSite.includes("localhost") ? "https://devinquire.com" : baseSite;

      const payloadObj = {
        ...existingParsed,
        platform: plt,
        blogId: body.blogId || existingParsed.blogId || null,
        title: resolvedTitle,
        caption: caption || resolvedTitle,
        hashtags,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : existingParsed.imageUrl || "",
        articleUrl:
          body.articleUrl !== undefined
            ? body.articleUrl
            : existingParsed.articleUrl || cleanSite,
        category: body.category || existingParsed.category || "Engineering",
        authorName:
          body.authorName ||
          existingParsed.authorName ||
          blogCfg.defaultAuthor ||
          "DevInquire Editorial",
        accountHandle:
          plt === "instagram"
            ? socialCfg.instagramHandle || "@devinquire"
            : socialCfg.facebookPageName || "DevInquire",
        status: finalStatus,
        customEdited: true,
        updatedAt: new Date().toISOString(),
      };

      if (body.publishNow) {
        const dispatched = await dispatchToExternalSocial(payloadObj, socialCfg);
        if (dispatched.dispatched) {
          finalStatus = "published";
          payloadObj.status = "published";
          payloadObj.dispatched = true;
          payloadObj.deliveryChannel = dispatched.deliveryChannel;
          payloadObj.externalPostId = dispatched.externalPostId;
          payloadObj.externalUrl = dispatched.externalUrl;
          payloadObj.publishedAt = dispatched.publishedAt;
          payloadObj.lastDispatchError = null;
        } else {
          finalStatus = "draft";
          payloadObj.status = "draft";
          payloadObj.lastDispatchError = dispatched.error;
          dispatchErrors.push(
            `${plt === "instagram" ? "Instagram" : "Facebook"}: ${
              dispatched.error || "Publish failed"
            }`
          );
        }
      }

      const payloadStr = JSON.stringify(payloadObj);

      let recordId = existingId;
      if (existingId) {
        await db.query(
          "UPDATE social_posts SET title = $1, caption = $2, status = $3, payload = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5",
          [resolvedTitle, payloadObj.caption, finalStatus, payloadStr, existingId]
        );
      } else {
        const ins = await db.query(
          "INSERT INTO social_posts (blog_id, platform, title, caption, status, payload) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
          [
            payloadObj.blogId ? Number(payloadObj.blogId) : null,
            plt,
            resolvedTitle,
            payloadObj.caption,
            finalStatus,
            payloadStr,
          ]
        );
        recordId = ins.rows?.[0]?.id;
      }

      savedPosts.push({
        ...payloadObj,
        id: String(recordId || Date.now()),
      });
    }

    if (body.publishNow && dispatchErrors.length > 0) {
      return sendJsonResponse(
        res,
        "error",
        `Saved draft, but live publish failed — ${dispatchErrors.join(" | ")}`,
        { posts: savedPosts, errors: dispatchErrors },
        400
      );
    }

    return sendJsonResponse(
      res,
      "success",
      body.publishNow
        ? `Published live to ${savedPosts
            .map((p) => (p.platform === "instagram" ? "Instagram" : "Facebook"))
            .join(" & ")}!`
        : "Social post saved.",
      {
        posts: savedPosts,
      }
    );
  } catch (err) {
    console.error("Social Save API Error:", err);
    return sendJsonResponse(res, "error", "Failed to save social post.", null, 500);
  }
});

// Publish / Dispatch Social Post Immediately
router.post(socialPublishPaths, requireMutatingAuth, async (req, res) => {
  const { id } = req.body || {};
  if (!id) {
    return sendJsonResponse(res, "error", "Social post ID required.", null, 400);
  }

  try {
    await ensureSocialPostsTable();
    const socialCfg = await loadSocialConfig();
    const foundRes = await db.query(
      "SELECT id, blog_id, platform, title, caption, status, payload, created_at, updated_at FROM social_posts WHERE id = $1 LIMIT 1",
      [id]
    );
    const row = foundRes.rows?.[0];
    if (!row) {
      return sendJsonResponse(res, "error", "Social post not found.", null, 404);
    }

    const parsed = parseSocialRow(row);
    const dispatched = await dispatchToExternalSocial(parsed, socialCfg);
    const platformLabel = parsed.platform === "instagram" ? "Instagram" : "Facebook";

    if (!dispatched.dispatched) {
      const failedPayload = {
        ...parsed,
        status: "draft",
        lastDispatchError: dispatched.error || `Could not publish to ${platformLabel}.`,
        updatedAt: new Date().toISOString(),
      };
      await db.query(
        "UPDATE social_posts SET title = $1, caption = $2, status = $3, payload = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5",
        [failedPayload.title, failedPayload.caption, "draft", JSON.stringify(failedPayload), row.id]
      );
      return sendJsonResponse(
        res,
        "error",
        dispatched.error || `Failed to publish to ${platformLabel}.`,
        failedPayload,
        400
      );
    }

    const nextPayload = {
      ...parsed,
      status: "published",
      dispatched: true,
      deliveryChannel: dispatched.deliveryChannel,
      externalPostId: dispatched.externalPostId,
      externalUrl: dispatched.externalUrl,
      publishedAt: dispatched.publishedAt,
      lastDispatchError: null,
      updatedAt: new Date().toISOString(),
    };

    await db.query(
      "UPDATE social_posts SET title = $1, caption = $2, status = $3, payload = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5",
      [nextPayload.title, nextPayload.caption, "published", JSON.stringify(nextPayload), row.id]
    );

    const msg =
      dispatched.deliveryChannel === "meta_graph_api"
        ? `${platformLabel} post published live on ${platformLabel}!`
        : `${platformLabel} post published via automation webhook!`;

    return sendJsonResponse(res, "success", msg, nextPayload);
  } catch (err) {
    console.error("Social Publish API Error:", err);
    return sendJsonResponse(res, "error", "Failed to publish social post.", null, 500);
  }
});

// Delete Social Post
router.post(socialDeletePaths, requireMutatingAuth, async (req, res) => {
  const { id } = req.body || {};
  if (!id) {
    return sendJsonResponse(res, "error", "Social post ID required.", null, 400);
  }

  try {
    await ensureSocialPostsTable();
    await db.query("DELETE FROM social_posts WHERE id = $1", [id]);
    return sendJsonResponse(res, "success", "Social post deleted.");
  } catch (err) {
    console.error("Social Delete API Error:", err);
    return sendJsonResponse(res, "error", "Failed to delete social post.", null, 500);
  }
});

// Populate / Sync All Existing Blogs to Instagram & Facebook
router.post(socialPopulateAllPaths, requireMutatingAuth, async (req, res) => {
  const { forceOverwrite = false } = req.body || {};
  try {
    await ensureSocialPostsTable();
    const blogsRes = await db.query(
      `SELECT b.*, COALESCE(b.author_name, u.name, 'DevInquire Editorial') as author_name
       FROM blog_posts b
       LEFT JOIN users u ON b.author_id = u.id
       ORDER BY b.created_at ASC`
    );
    const blogs = blogsRes.rows || [];
    let totalSynced = 0;

    for (const blog of blogs) {
      let parsedTags = blog.tags;
      if (typeof parsedTags === "string") {
        try {
          parsedTags = JSON.parse(parsedTags);
        } catch {
          parsedTags = [];
        }
      }
      const synced = await syncBlogToSocialChannels(
        {
          ...blog,
          tags: Array.isArray(parsedTags) ? parsedTags : [],
        },
        {
          enableInstagram: true,
          enableFacebook: true,
          forceOverwrite: Boolean(forceOverwrite),
        }
      );
      totalSynced += synced.length;
    }

    const socialCfg = {
      ...DEFAULT_SOCIAL_CONFIG,
      ...(db.getSettings("social_config") || {}),
    };
    db.updateSettings("social_config", {
      ...socialCfg,
      lastSyncAt: new Date().toISOString(),
      lastSyncedCount: totalSynced,
    });

    return sendJsonResponse(
      res,
      "success",
      blogs.length > 0
        ? `Populated ${totalSynced} Instagram & Facebook post${totalSynced === 1 ? "" : "s"} from ${blogs.length} blog article${blogs.length === 1 ? "" : "s"}.`
        : "No blog articles found yet — create an article or run daily.dev pull to auto-populate all channels.",
      { blogCount: blogs.length, socialCount: totalSynced }
    );
  } catch (err) {
    console.error("Social Populate All Error:", err);
    return sendJsonResponse(res, "error", "Failed to populate social channels from blogs.", null, 500);
  }
});

// Get Social & Omnichannel Automation Config
router.get(socialConfigPaths, requireAuth, async (req, res) => {
  try {
    const cfg = await loadSocialConfig();
    return sendJsonResponse(res, "success", "Social configuration retrieved.", cfg);
  } catch (err) {
    console.error("Social Config Get Error:", err);
    return sendJsonResponse(res, "error", "Failed to load social configuration.", null, 500);
  }
});

// Save Social & Omnichannel Automation Config
router.post(socialConfigPaths, requireMutatingAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const current = await loadSocialConfig();

    let hashtags = current.defaultHashtags;
    if (Array.isArray(body.defaultHashtags)) {
      hashtags = body.defaultHashtags.map(normalizeHashtag).filter(Boolean);
    } else if (typeof body.defaultHashtags === "string") {
      hashtags = body.defaultHashtags
        .split(/[\s,]+/)
        .map(normalizeHashtag)
        .filter(Boolean);
    }

    // Never wipe out already-connected Meta tokens if client state was stale (use /social/disconnect to clear)
    const preserveIfBlank = (incoming, existing) =>
      incoming !== undefined && String(incoming).trim() !== ""
        ? String(incoming).trim()
        : existing || "";

    const updated = await saveSocialConfig({
      ...current,
      ...body,
      metaAppId: preserveIfBlank(body.metaAppId, current.metaAppId),
      metaAppSecret: preserveIfBlank(body.metaAppSecret, current.metaAppSecret),
      facebookPageId: preserveIfBlank(body.facebookPageId, current.facebookPageId),
      facebookAccessToken: preserveIfBlank(body.facebookAccessToken, current.facebookAccessToken),
      instagramAccountId: preserveIfBlank(body.instagramAccountId, current.instagramAccountId),
      instagramAccessToken: preserveIfBlank(
        body.instagramAccessToken,
        current.instagramAccessToken
      ),
      connectedPages:
        Array.isArray(body.connectedPages) && body.connectedPages.length > 0
          ? body.connectedPages
          : current.connectedPages || [],
      defaultHashtags: hashtags,
    });
    return sendJsonResponse(
      res,
      "success",
      "Instagram & Facebook automation settings saved.",
      updated
    );
  } catch (err) {
    console.error("Social Config Save Error:", err);
    return sendJsonResponse(res, "error", "Failed to save social configuration.", null, 500);
  }
});

/* ============================================================
 *  Meta (Facebook Page + Instagram Business) Connect & OAuth
 * ============================================================ */

async function discoverMetaAccounts(rawToken, appId = "", appSecret = "") {
  let tokenToUse = String(rawToken || "").trim();
  if (!tokenToUse) {
    throw new Error("Meta Access Token is required.");
  }

  // Exchange for 60-day long-lived user token when App ID & Secret are provided
  if (appId && appSecret) {
    try {
      const exchangeUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
      exchangeUrl.searchParams.set("grant_type", "fb_exchange_token");
      exchangeUrl.searchParams.set("client_id", appId);
      exchangeUrl.searchParams.set("client_secret", appSecret);
      exchangeUrl.searchParams.set("fb_exchange_token", tokenToUse);

      const exRes = await fetch(exchangeUrl.toString(), {
        signal: AbortSignal.timeout(10000),
      });
      const exJson = await exRes.json().catch(() => ({}));
      if (exRes.ok && exJson.access_token) {
        tokenToUse = exJson.access_token;
      }
    } catch {
      // keep original token if exchange not applicable (e.g. already a Page token)
    }
  }

  const fields =
    "id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}";
  const accountsUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=${encodeURIComponent(
    fields
  )}&access_token=${encodeURIComponent(tokenToUse)}`;

  const accRes = await fetch(accountsUrl, {
    signal: AbortSignal.timeout(10000),
  });
  const accJson = await accRes.json().catch(() => ({}));

  let rawPages = [];
  if (accRes.ok && Array.isArray(accJson.data) && accJson.data.length > 0) {
    rawPages = accJson.data;
  } else {
    // Fallback: user may have pasted a Page Access Token directly instead of a User token
    const mePageUrl = `https://graph.facebook.com/v21.0/me?fields=${encodeURIComponent(
      "id,name,picture{url},instagram_business_account{id,username,name,profile_picture_url}"
    )}&access_token=${encodeURIComponent(tokenToUse)}`;
    const meRes = await fetch(mePageUrl, {
      signal: AbortSignal.timeout(10000),
    });
    const meJson = await meRes.json().catch(() => ({}));
    if (!meRes.ok || meJson.error) {
      throw new Error(
        accJson?.error?.message ||
          meJson?.error?.message ||
          "Meta Graph API rejected the token."
      );
    }
    if (meJson.id) {
      rawPages = [{ ...meJson, access_token: tokenToUse }];
    }
  }

  if (rawPages.length === 0) {
    throw new Error(
      "No Facebook Pages found on this Meta account. Make sure you granted pages_show_list and pages_manage_posts permissions."
    );
  }

  const connectedPages = rawPages.map((p) => ({
    pageId: String(p.id),
    pageName: p.name || "Facebook Page",
    pagePicture: p.picture?.data?.url || "",
    pageAccessToken: p.access_token || tokenToUse,
    instagramAccountId: p.instagram_business_account?.id
      ? String(p.instagram_business_account.id)
      : "",
    instagramUsername: p.instagram_business_account?.username
      ? `@${String(p.instagram_business_account.username).replace(/^@/, "")}`
      : "",
    instagramName: p.instagram_business_account?.name || "",
    instagramPicture: p.instagram_business_account?.profile_picture_url || "",
  }));

  return connectedPages;
}

function applySelectedPageToConfig(currentCfg, connectedPages, preferredPageId = null) {
  const chosen =
    (preferredPageId &&
      connectedPages.find((p) => String(p.pageId) === String(preferredPageId))) ||
    connectedPages.find((p) => Boolean(p.instagramAccountId)) ||
    connectedPages[0];

  const nowIso = new Date().toISOString();
  return {
    ...currentCfg,
    connectedPages,
    facebookPageId: chosen.pageId,
    facebookPageName: chosen.pageName || currentCfg.facebookPageName,
    facebookAccessToken: chosen.pageAccessToken,
    instagramAccountId: chosen.instagramAccountId || "",
    instagramAccessToken: chosen.instagramAccountId ? chosen.pageAccessToken : "",
    instagramHandle:
      chosen.instagramUsername || currentCfg.instagramHandle || "@devinquire",
    connectedAt: nowIso,
    lastVerifiedAt: nowIso,
    lastDispatchError: null,
  };
}

// 1. Generate Meta OAuth Login URL (Supports Both Popup & Same-Tab Redirect)
router.post(socialOAuthUrlPaths, requireMutatingAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const current = await loadSocialConfig();

    const metaAppId = String(
      body.metaAppId || current.metaAppId || process.env.META_APP_ID || ""
    ).trim();
    const metaAppSecret = String(
      body.metaAppSecret || current.metaAppSecret || process.env.META_APP_SECRET || ""
    ).trim();
    const metaConfigId = String(body.metaConfigId ?? current.metaConfigId ?? "").trim();
    const oauthScopeMode = body.oauthScopeMode || current.oauthScopeMode || "instagram_and_facebook";
    const includeBusinessManagement = Boolean(
      body.includeBusinessManagement ?? current.includeBusinessManagement
    );
    const mode = body.mode === "redirect" ? "redirect" : "popup";

    if (!metaAppId || !metaAppSecret) {
      return sendJsonResponse(
        res,
        "error",
        "Enter both your Meta App ID and Meta App Secret first (or paste a Graph Explorer Access Token in Instant Token Connect below).",
        null,
        400
      );
    }

    // Persist App ID & Secret to SQL immediately so any worker handling callback reads them
    await saveSocialConfig({
      metaAppId,
      metaAppSecret,
      metaConfigId,
      oauthScopeMode,
      includeBusinessManagement,
    });

    const origin = String(
      body.redirectOrigin || `${req.protocol}://${req.get("host")}`
    ).replace(/\/$/, "");
    const redirectUri = `${origin}/api/blog/social/oauth/callback`;

    const state = createOAuthState({
      redirectUri,
      returnOrigin: origin,
      mode,
    });

    const scopeList =
      oauthScopeMode === "facebook_only"
        ? ["pages_show_list", "pages_read_engagement", "pages_manage_posts"]
        : [
            "pages_show_list",
            "pages_read_engagement",
            "pages_manage_posts",
            "instagram_basic",
            "instagram_content_publish",
          ];
    if (includeBusinessManagement) {
      scopeList.push("business_management");
    }

    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", metaAppId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("auth_type", "rerequest");
    if (metaConfigId) {
      authUrl.searchParams.set("config_id", metaConfigId);
    } else {
      authUrl.searchParams.set("scope", scopeList.join(","));
    }

    return sendJsonResponse(res, "success", "Meta OAuth URL generated.", {
      authUrl: authUrl.toString(),
      redirectUri,
    });
  } catch (err) {
    console.error("Meta OAuth URL Error:", err);
    return sendJsonResponse(res, "error", "Failed to build Meta OAuth URL.", null, 500);
  }
});

// 2. Meta OAuth Callback (Stateless Multi-Worker + BroadcastChannel + Redirect Support)
router.get(socialOAuthCallbackPaths, async (req, res) => {
  const { code, state, error, error_description } = req.query || {};
  const stateEntry = verifyOAuthState(String(state || ""));

  const finishOAuth = (ok, message) => {
    const returnOrigin = stateEntry?.returnOrigin || `${req.protocol}://${req.get("host")}`;
    if (stateEntry?.mode === "redirect") {
      const target = `${returnOrigin}/?meta_oauth=${
        ok ? "success" : "error"
      }&meta_msg=${encodeURIComponent(String(message || ""))}#/blogs`;
      return res.redirect(302, target);
    }

    const safeMsg = String(message || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const payloadJson = JSON.stringify({
      type: "DI_META_OAUTH_RESULT",
      status: ok ? "success" : "error",
      message: String(message || ""),
      ts: Date.now(),
    });
    const dashboardLink = `${returnOrigin}/#/blogs`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>DevInquire — Meta Connection</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f1117; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 24px; }
    .card { max-width: 440px; background: #1c1e26; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: ${ok ? "rgba(40,205,65,0.15)" : "rgba(255,59,48,0.15)"}; color: ${ok ? "#30D158" : "#FF453A"}; margin-bottom: 12px; }
    h2 { margin: 0 0 8px; font-size: 18px; }
    p { margin: 0 0 18px; font-size: 13px; color: #a0a6b5; line-height: 1.5; }
    .btn { display: inline-block; background: #4e45e1; color: #fff; text-decoration: none; border: 0; border-radius: 10px; padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${ok ? "Connected" : "Connection Failed"}</div>
    <h2>${ok ? "Facebook & Instagram Linked" : "Could Not Complete OAuth"}</h2>
    <p>${safeMsg}</p>
    <button class="btn" onclick="closeOrReturn()">Return to Dashboard</button>
  </div>
  <script>
    const payload = ${payloadJson};
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("di_meta_oauth");
        bc.postMessage(payload);
      }
    } catch (e) {}
    try {
      localStorage.setItem("di_meta_oauth_event", JSON.stringify(payload));
    } catch (e) {}
    try {
      if (window.opener) {
        window.opener.postMessage(payload, "*");
      }
    } catch (e) {}
    function closeOrReturn() {
      window.close();
      setTimeout(function() { window.location.href = ${JSON.stringify(dashboardLink)}; }, 300);
    }
    ${ok ? "setTimeout(function() { window.close(); }, 1200);" : ""}
  </script>
</body>
</html>`);
  };

  if (error) {
    return finishOAuth(false, error_description || String(error));
  }
  if (!code || !stateEntry) {
    return finishOAuth(false, "Invalid or expired OAuth state. Please click Connect again.");
  }

  try {
    const current = await loadSocialConfig();
    const appId = current.metaAppId || process.env.META_APP_ID;
    const appSecret = current.metaAppSecret || process.env.META_APP_SECRET;

    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("redirect_uri", stateEntry.redirectUri);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("code", String(code));

    const tokenRes = await fetch(tokenUrl.toString(), {
      signal: AbortSignal.timeout(12000),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.access_token) {
      return finishOAuth(
        false,
        tokenJson?.error?.message || "Failed to exchange authorization code with Meta."
      );
    }

    const pages = await discoverMetaAccounts(tokenJson.access_token, appId, appSecret);
    const nextCfg = applySelectedPageToConfig(current, pages);
    await saveSocialConfig(nextCfg);

    const igNote = nextCfg.instagramAccountId
      ? ` and Instagram (${nextCfg.instagramHandle})`
      : " (no linked Instagram Business account detected on this Page — link IG in Facebook Page Settings to enable IG)";
    return finishOAuth(
      true,
      `Connected Facebook Page "${nextCfg.facebookPageName}"${igNote}.`
    );
  } catch (err) {
    return finishOAuth(false, err.message || "Meta account discovery failed.");
  }
});

// 3. Auto-Discover Facebook Pages & Linked Instagram Account from Access Token
router.post(socialDiscoverPaths, requireMutatingAuth, async (req, res) => {
  const { accessToken, metaAppId, metaAppSecret } = req.body || {};
  if (!accessToken || !String(accessToken).trim()) {
    return sendJsonResponse(res, "error", "Paste a Meta User or Page Access Token first.", null, 400);
  }

  try {
    const current = await loadSocialConfig();
    const resolvedAppId = String(metaAppId || current.metaAppId || "").trim();
    const resolvedSecret = String(metaAppSecret || current.metaAppSecret || "").trim();

    const pages = await discoverMetaAccounts(accessToken, resolvedAppId, resolvedSecret);
    const nextCfg = applySelectedPageToConfig(
      {
        ...current,
        metaAppId: resolvedAppId,
        metaAppSecret: resolvedSecret,
      },
      pages
    );
    const saved = await saveSocialConfig(nextCfg);

    const igPart = saved.instagramAccountId
      ? ` + Instagram ${saved.instagramHandle}`
      : " (link an Instagram Business account to your Page to enable IG direct publishing)";

    return sendJsonResponse(
      res,
      "success",
      `Connected Facebook Page "${saved.facebookPageName}"${igPart}.`,
      saved
    );
  } catch (err) {
    console.error("Meta Auto-Discover Error:", err);
    return sendJsonResponse(
      res,
      "error",
      err.message || "Could not discover Facebook Page / Instagram account.",
      null,
      400
    );
  }
});

// 4. Switch Active Facebook Page + Linked Instagram Account
router.post(socialSelectPagePaths, requireMutatingAuth, async (req, res) => {
  const { pageId } = req.body || {};
  if (!pageId) {
    return sendJsonResponse(res, "error", "Page ID is required.", null, 400);
  }

  try {
    const current = await loadSocialConfig();
    const pages = Array.isArray(current.connectedPages) ? current.connectedPages : [];
    const found = pages.find((p) => String(p.pageId) === String(pageId));
    if (!found) {
      return sendJsonResponse(res, "error", "Selected page not found in connected accounts.", null, 404);
    }

    const nextCfg = applySelectedPageToConfig(current, pages, pageId);
    const saved = await saveSocialConfig(nextCfg);
    return sendJsonResponse(
      res,
      "success",
      `Switched active Page to "${saved.facebookPageName}".`,
      saved
    );
  } catch (err) {
    return sendJsonResponse(res, "error", "Failed to switch page.", null, 500);
  }
});

// 5. Verify / Test Live Facebook Page, Instagram Business & Webhook Connection
router.post(socialVerifyPaths, requireMutatingAuth, async (req, res) => {
  try {
    const savedCfg = await loadSocialConfig();
    const body = req.body || {};
    const current = {
      ...savedCfg,
      facebookPageId: body.facebookPageId || savedCfg.facebookPageId,
      facebookAccessToken: body.facebookAccessToken || savedCfg.facebookAccessToken,
      instagramAccountId: body.instagramAccountId || savedCfg.instagramAccountId,
      instagramAccessToken: body.instagramAccessToken || savedCfg.instagramAccessToken,
      webhookUrl: body.webhookUrl !== undefined ? body.webhookUrl : savedCfg.webhookUrl,
    };

    const status = {
      facebook: { connected: false, name: null, id: null, followers: null, error: null },
      instagram: { connected: false, username: null, id: null, followers: null, error: null },
      webhook: { configured: Boolean(current.webhookUrl && String(current.webhookUrl).trim()) },
    };

    if (current.facebookPageId && current.facebookAccessToken) {
      try {
        const fbUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(
          current.facebookPageId
        )}?fields=id,name,followers_count,fan_count&access_token=${encodeURIComponent(
          current.facebookAccessToken
        )}`;
        const fbRes = await fetch(fbUrl, { signal: AbortSignal.timeout(8000) });
        const fbJson = await fbRes.json().catch(() => ({}));
        if (fbRes.ok && fbJson.id) {
          status.facebook = {
            connected: true,
            name: fbJson.name || current.facebookPageName,
            id: fbJson.id,
            followers: fbJson.followers_count ?? fbJson.fan_count ?? null,
            error: null,
          };
        } else {
          status.facebook.error = fbJson?.error?.message || `HTTP ${fbRes.status}`;
        }
      } catch (err) {
        status.facebook.error = err.message;
      }
    }

    if (current.instagramAccountId && current.instagramAccessToken) {
      try {
        const igUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(
          current.instagramAccountId
        )}?fields=id,username,name,followers_count&access_token=${encodeURIComponent(
          current.instagramAccessToken
        )}`;
        const igRes = await fetch(igUrl, { signal: AbortSignal.timeout(8000) });
        const igJson = await igRes.json().catch(() => ({}));
        if (igRes.ok && igJson.id) {
          status.instagram = {
            connected: true,
            username: igJson.username ? `@${igJson.username}` : current.instagramHandle,
            id: igJson.id,
            followers: igJson.followers_count ?? null,
            error: null,
          };
        } else {
          status.instagram.error = igJson?.error?.message || `HTTP ${igRes.status}`;
        }
      } catch (err) {
        status.instagram.error = err.message;
      }
    }

    if (status.facebook.connected || status.instagram.connected || status.webhook.configured) {
      await saveSocialConfig({
        facebookPageName: status.facebook.name || current.facebookPageName,
        instagramHandle: status.instagram.username || current.instagramHandle,
        lastVerifiedAt: new Date().toISOString(),
      });
    }

    const parts = [];
    if (status.facebook.connected) parts.push(`FB Page "${status.facebook.name}" verified`);
    if (status.instagram.connected) parts.push(`IG ${status.instagram.username} verified`);
    if (status.webhook.configured) parts.push("Webhook active");

    if (parts.length === 0) {
      const errDetail =
        status.facebook.error ||
        status.instagram.error ||
        "No valid Meta tokens or Webhook URL configured yet.";
      return sendJsonResponse(res, "error", `Connection check failed: ${errDetail}`, status, 400);
    }

    return sendJsonResponse(res, "success", parts.join(" • "), status);
  } catch (err) {
    console.error("Social Verify Error:", err);
    return sendJsonResponse(res, "error", "Failed to verify social connections.", null, 500);
  }
});

// 6. Disconnect Meta Accounts
router.post(socialDisconnectPaths, requireMutatingAuth, async (req, res) => {
  try {
    const current = await loadSocialConfig();
    const cleared = await saveSocialConfig({
      ...current,
      instagramAccountId: "",
      instagramAccessToken: "",
      facebookPageId: "",
      facebookAccessToken: "",
      connectedPages: [],
      connectedAt: null,
      lastVerifiedAt: null,
      lastDispatchError: null,
    });
    return sendJsonResponse(res, "success", "Disconnected Facebook Page and Instagram account.", cleared);
  } catch (err) {
    return sendJsonResponse(res, "error", "Failed to disconnect social accounts.", null, 500);
  }
});

export default router;
