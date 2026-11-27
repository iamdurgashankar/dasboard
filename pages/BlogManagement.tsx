import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SocialPlatform, SocialPost } from '../types';
import { generateBlogPostDraft } from '../services/geminiService';
import { api } from '../services/api';

interface BlogConfig {
  siteUrl: string;
  defaultAuthor: string;
  defaultStatus: 'draft' | 'published';
  autoSyncOnPublish: boolean;
  categories: string[];
  seoTitleSuffix: string;
}

interface ConnectedMetaPage {
  pageId: string;
  pageName: string;
  pagePicture?: string;
  instagramAccountId?: string;
  instagramUsername?: string;
  instagramName?: string;
  instagramPicture?: string;
}

interface SocialConfig {
  autoPopulateInstagram: boolean;
  autoPopulateFacebook: boolean;
  autoSyncOnBlogUpdate: boolean;
  autoPopulateDailyDev: boolean;
  autoPublishOnBlogPublish: boolean;
  instagramHandle: string;
  facebookPageName: string;
  defaultHashtags: string[];
  ctaTemplate: string;
  defaultSocialImageUrl?: string;
  metaAppId?: string;
  metaAppSecret?: string;
  metaConfigId?: string;
  oauthScopeMode?: 'instagram_and_facebook' | 'facebook_only';
  includeBusinessManagement?: boolean;
  instagramAccountId: string;
  instagramAccessToken: string;
  facebookPageId: string;
  facebookAccessToken: string;
  webhookUrl: string;
  connectedPages?: ConnectedMetaPage[];
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncedCount?: number;
  lastDispatchError?: string | null;
}

const DEFAULT_BLOG_CONFIG: BlogConfig = {
  siteUrl: 'https://devinquire.com',
  defaultAuthor: 'DevInquire Editorial',
  defaultStatus: 'draft',
  autoSyncOnPublish: true,
  categories: [
    'Engineering',
    'Architecture',
    'AI & Systems',
    'Cloud & DevOps',
    'Product Strategy',
    'Security',
  ],
  seoTitleSuffix: ' | DevInquire Insights',
};

const DEFAULT_SOCIAL_CONFIG: SocialConfig = {
  autoPopulateInstagram: true,
  autoPopulateFacebook: true,
  autoSyncOnBlogUpdate: true,
  autoPopulateDailyDev: true,
  autoPublishOnBlogPublish: true,
  instagramHandle: '@devinquire',
  facebookPageName: 'DevInquire',
  defaultHashtags: ['DevInquire', 'SoftwareEngineering', 'TechInsights'],
  ctaTemplate: 'Read the full engineering breakdown:',
  defaultSocialImageUrl: '',
  metaAppId: '',
  metaAppSecret: '',
  metaConfigId: '',
  oauthScopeMode: 'instagram_and_facebook',
  includeBusinessManagement: false,
  instagramAccountId: '',
  instagramAccessToken: '',
  facebookPageId: '',
  facebookAccessToken: '',
  webhookUrl: '',
  connectedPages: [],
  connectedAt: null,
  lastVerifiedAt: null,
  lastSyncAt: null,
  lastSyncedCount: 0,
  lastDispatchError: null,
};

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const FacebookIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
  </svg>
);

function stripMarkdownClient(md: string): string {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildLiveSocialCaption(
  platform: SocialPlatform,
  blog: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    category: string;
    tags: string[];
  },
  blogCfg: BlogConfig,
  socialCfg: SocialConfig
): string {
  const cleanSite = (blogCfg.siteUrl || 'https://devinquire.com')
    .replace(/\/$/, '')
    .replace(/^http:\/\/localhost:\d+$/, 'https://devinquire.com');
  const slug =
    blog.slug ||
    blog.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') ||
    'new-article';
  const articleUrl = `${cleanSite}/blog/${slug}`;

  const rawTags = [
    blog.category,
    ...(blog.tags || []),
    ...(socialCfg.defaultHashtags || []),
  ]
    .map((t) => String(t || '').replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, ''))
    .filter(Boolean);
  const uniqueTags = Array.from(new Set(rawTags)).slice(0, 8);
  const hashtagLine = uniqueTags.map((t) => `#${t}`).join(' ');

  const plainBody = stripMarkdownClient(blog.content || '');
  const excerpt = String(blog.excerpt || '').trim();
  const cta = socialCfg.ctaTemplate || 'Read the full engineering breakdown:';
  const headline = blog.title.trim() || 'Untitled Engineering Article';

  if (platform === 'instagram') {
    const snippet =
      plainBody && plainBody !== excerpt
        ? plainBody.slice(0, 460) + (plainBody.length > 460 ? '…' : '')
        : '';
    return [
      `🚀 ${headline}`,
      excerpt ? `\n${excerpt}` : '',
      snippet ? `\n${snippet}` : '',
      `\n🔗 ${cta} ${articleUrl}`,
      hashtagLine ? `\n${hashtagLine}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const fbSnippet =
    plainBody && plainBody !== excerpt
      ? plainBody.slice(0, 760) + (plainBody.length > 760 ? '…' : '')
      : '';
  return [
    headline,
    excerpt ? `\n${excerpt}` : '',
    fbSnippet ? `\n${fbSnippet}` : '',
    `\n${cta}\n${articleUrl}`,
    hashtagLine ? `\n${hashtagLine}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const BlogManagement: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState<'blog' | 'instagram' | 'facebook'>('blog');

  const [blogs, setBlogs] = useState<any[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Blog Configuration state
  const [blogConfig, setBlogConfig] = useState<BlogConfig>(DEFAULT_BLOG_CONFIG);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Social & Omnichannel Automation Configuration state
  const [socialConfig, setSocialConfig] = useState<SocialConfig>(DEFAULT_SOCIAL_CONFIG);
  const [showSocialConfigModal, setShowSocialConfigModal] = useState(false);
  const [isSavingSocialConfig, setIsSavingSocialConfig] = useState(false);
  const [socialHashtagInput, setSocialHashtagInput] = useState('');
  const [isPopulatingSocial, setIsPopulatingSocial] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const savingLockRef = useRef(false);
  const automationLockRef = useRef(false);
  const socialPublishLockRef = useRef(false);
  const [quickConnectToken, setQuickConnectToken] = useState('');
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [isDiscoveringToken, setIsDiscoveringToken] = useState(false);
  const [isVerifyingConnection, setIsVerifyingConnection] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [socialModalNotice, setSocialModalNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const handleOAuthPayload = (payload: any) => {
      if (!payload || payload.type !== 'DI_META_OAUTH_RESULT') return;
      setIsConnectingOAuth(false);
      if (payload.status === 'success') {
        setSocialModalNotice({
          type: 'success',
          text: payload.message || 'Facebook Page & Instagram connected successfully.',
        });
        showToast(payload.message || 'Facebook Page & Instagram connected.');
        fetchSocialConfig();
      } else {
        setSocialModalNotice({
          type: 'error',
          text: payload.message || 'Meta OAuth connection failed.',
        });
      }
    };

    // Check URL query params for Same-Tab Redirect OAuth return
    try {
      const params = new URLSearchParams(window.location.search);
      const oauthStatus = params.get('meta_oauth');
      const oauthMsg = params.get('meta_msg');
      if (oauthStatus) {
        setShowSocialConfigModal(true);
        handleOAuthPayload({
          type: 'DI_META_OAUTH_RESULT',
          status: oauthStatus,
          message: oauthMsg || '',
        });
        const cleanUrl = `${window.location.pathname}${window.location.hash || '#/blogs'}`;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch {
      // ignore URL parse errors
    }

    const onMessage = (event: MessageEvent) => handleOAuthPayload(event.data);
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'di_meta_oauth_event' && event.newValue) {
        try {
          handleOAuthPayload(JSON.parse(event.newValue));
        } catch {
          // ignore
        }
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('di_meta_oauth');
        bc.onmessage = (ev) => handleOAuthPayload(ev.data);
      }
    } catch {
      // ignore if BroadcastChannel unsupported
    }

    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
      if (bc) bc.close();
    };
  }, []);

  // daily.dev + Omnichannel Automation Workflow state
  const [showAutomationPanel, setShowAutomationPanel] = useState(false);
  const [isRunningAutomation, setIsRunningAutomation] = useState(false);
  const [isSavingAutomation, setIsSavingAutomation] = useState(false);
  const [automationConfig, setAutomationConfig] = useState<{
    enabled: boolean;
    intervalMinutes: number;
    autoPublish: boolean;
    maxPerRun: number;
    categoryOverride: string;
    autoPopulateSocial: boolean;
    lastRunAt: string | null;
    lastImportedCount: number;
    lastSkippedCount: number;
    lastSocialCount?: number;
    lastError: string | null;
  }>({
    enabled: false,
    intervalMinutes: 360,
    autoPublish: true,
    maxPerRun: 10,
    categoryOverride: 'Auto',
    autoPopulateSocial: true,
    lastRunAt: null,
    lastImportedCount: 0,
    lastSkippedCount: 0,
    lastSocialCount: 0,
    lastError: null,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer / Editor state
  const [isComposing, setIsComposing] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isSavingPost, setIsSavingPost] = useState(false);

  // Composer Omnichannel Social state
  const [composerInstagramEnabled, setComposerInstagramEnabled] = useState(true);
  const [composerFacebookEnabled, setComposerFacebookEnabled] = useState(true);
  const [customizeSocialCaptions, setCustomizeSocialCaptions] = useState(false);
  const [customInstagramCaption, setCustomInstagramCaption] = useState('');
  const [customFacebookCaption, setCustomFacebookCaption] = useState('');

  // Standalone Social Post Editor Modal
  const [showSocialComposerModal, setShowSocialComposerModal] = useState(false);
  const [isSavingSocialPost, setIsSavingSocialPost] = useState(false);
  const [publishingSocialId, setPublishingSocialId] = useState<string | null>(null);
  const [socialDraft, setSocialDraft] = useState<{
    id?: string;
    platforms: SocialPlatform[];
    title: string;
    caption: string;
    imageUrl: string;
    articleUrl: string;
    category: string;
    hashtagsText: string;
    status: 'draft' | 'published';
  }>({
    platforms: ['instagram', 'facebook'],
    title: '',
    caption: '',
    imageUrl: '',
    articleUrl: 'https://devinquire.com',
    category: 'Engineering',
    hashtagsText: 'DevInquire, SoftwareEngineering, TechInsights',
    status: 'draft',
  });

  // Reader modal
  const [readingPost, setReadingPost] = useState<any | null>(null);

  const [currentBlog, setCurrentBlog] = useState<{
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    category: string;
    author_name: string;
    status: 'draft' | 'published';
    featured_image: string;
    tags: string[];
  }>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category: 'Engineering',
    author_name: 'DevInquire Editorial',
    status: 'draft',
    featured_image: '',
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchBlogs();
    fetchSocialPosts();
    fetchBlogConfig();
    fetchSocialConfig();
    fetchAutomationStatus();
  }, []);

  const fetchSocialPosts = async () => {
    try {
      const res = await api.blog.listSocial();
      if (res.status === 'success' && Array.isArray(res.data)) {
        setSocialPosts(res.data);
      }
    } catch {
      // ignore
    }
  };

  const fetchSocialConfig = async () => {
    try {
      const res = await api.blog.getSocialConfig();
      if (res.status === 'success' && res.data) {
        setSocialConfig((prev) => ({
          ...prev,
          ...res.data,
          defaultHashtags: Array.isArray(res.data.defaultHashtags)
            ? res.data.defaultHashtags
            : prev.defaultHashtags,
        }));
      }
    } catch {
      // keep defaults
    }
  };

  const fetchAutomationStatus = async () => {
    try {
      const res = await api.blog.getAutomationStatus();
      if (res.status === 'success' && res.data) {
        setAutomationConfig((prev) => ({ ...prev, ...res.data }));
      }
    } catch {
      // keep default automation config
    }
  };

  const handleSaveAutomation = async () => {
    setIsSavingAutomation(true);
    try {
      const res = await api.blog.saveAutomationConfig(automationConfig);
      if (res.status === 'success') {
        if (res.data) setAutomationConfig((prev) => ({ ...prev, ...res.data }));
        showToast(
          automationConfig.enabled
            ? `Omnichannel auto-sync enabled (every ${
                automationConfig.intervalMinutes / 60 >= 1
                  ? `${automationConfig.intervalMinutes / 60}h`
                  : `${automationConfig.intervalMinutes}m`
              } → Blog, Instagram & Facebook).`
            : 'Omnichannel automation workflow saved.'
        );
      } else {
        setError(res.message || 'Failed to save automation workflow.');
      }
    } catch {
      setError('Failed to save automation workflow.');
    } finally {
      setIsSavingAutomation(false);
    }
  };

  const handleRunAutomationNow = async () => {
    if (automationLockRef.current) return;
    automationLockRef.current = true;
    setIsRunningAutomation(true);
    setError(null);
    try {
      const res = await api.blog.runAutomationNow({
        maxPerRun: automationConfig.maxPerRun,
        autoPublish: automationConfig.autoPublish,
        categoryOverride: automationConfig.categoryOverride,
        autoPopulateSocial: automationConfig.autoPopulateSocial,
      });
      if (res.status === 'success') {
        if (res.data?.automation) {
          setAutomationConfig((prev) => ({ ...prev, ...res.data.automation }));
        }
        showToast(res.message || 'Synced tech news across Blog, Instagram & Facebook.');
        await Promise.all([fetchBlogs(), fetchSocialPosts()]);
      } else {
        setError(res.message || 'Failed to pull tech news from daily.dev.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to pull tech news from daily.dev.');
    } finally {
      automationLockRef.current = false;
      setIsRunningAutomation(false);
    }
  };

  const handleDeduplicatePosts = async () => {
    setIsDeduplicating(true);
    setError(null);
    try {
      const res = await api.blog.deduplicatePosts();
      if (res.status === 'success') {
        await Promise.all([fetchBlogs(), fetchSocialPosts()]);
        showToast(res.message || 'Removed duplicate posts.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to remove duplicate posts.');
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handlePopulateAllSocial = async (forceOverwrite: boolean = false) => {
    setIsPopulatingSocial(true);
    setError(null);
    try {
      const res = await api.blog.populateSocialFromBlogs(forceOverwrite);
      if (res.status === 'success') {
        await fetchSocialPosts();
        await fetchSocialConfig();
        showToast(res.message || 'Instagram & Facebook populated from Blog articles.');
      } else {
        setError(res.message || 'Failed to populate social channels.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to populate social channels.');
    } finally {
      setIsPopulatingSocial(false);
    }
  };

  const fetchBlogConfig = async () => {
    try {
      const res = await api.blog.getConfig();
      if (res.status === 'success' && res.data) {
        setBlogConfig({
          ...DEFAULT_BLOG_CONFIG,
          ...res.data,
          categories:
            Array.isArray(res.data.categories) && res.data.categories.length > 0
              ? res.data.categories
              : DEFAULT_BLOG_CONFIG.categories,
        });
      }
    } catch {
      // keep default config
    }
  };

  const fetchBlogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.blog.list();
      if (res.status === 'success') {
        const mapped = (res.data || []).map((b: any) => ({
          ...b,
          id: String(b.id),
          author: b.author_name || blogConfig.defaultAuthor || 'DevInquire Editorial',
          date: b.created_at ? String(b.created_at).split('T')[0].split(' ')[0] : 'Today',
          status: b.status === 'published' || b.status === 'synced' ? 'published' : 'draft',
          tags: Array.isArray(b.tags) ? b.tags : [],
        }));
        setBlogs(mapped);
        setError(null);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError('Failed to connect to Editorial Studio service.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSlug = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const liveAutoInstagramCaption = useMemo(
    () => buildLiveSocialCaption('instagram', currentBlog, blogConfig, socialConfig),
    [currentBlog, blogConfig, socialConfig]
  );

  const liveAutoFacebookCaption = useMemo(
    () => buildLiveSocialCaption('facebook', currentBlog, blogConfig, socialConfig),
    [currentBlog, blogConfig, socialConfig]
  );

  const openNewComposer = () => {
    setActiveChannel('blog');
    setEditingId(null);
    setCurrentBlog({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      category: blogConfig.categories[0] || 'Engineering',
      author_name: blogConfig.defaultAuthor || 'DevInquire Editorial',
      status: blogConfig.defaultStatus || 'draft',
      featured_image: '',
      tags: [],
    });
    setComposerInstagramEnabled(socialConfig.autoPopulateInstagram);
    setComposerFacebookEnabled(socialConfig.autoPopulateFacebook);
    setCustomizeSocialCaptions(false);
    setCustomInstagramCaption('');
    setCustomFacebookCaption('');
    setIsPreviewMode(false);
    setIsComposing(true);
  };

  const handleEdit = (post: any) => {
    setActiveChannel('blog');
    setEditingId(post.id);
    setCurrentBlog({
      title: post.title || '',
      slug: post.slug || generateSlug(post.title || ''),
      excerpt: post.excerpt || '',
      content: post.content || '',
      category: post.category || blogConfig.categories[0] || 'Engineering',
      author_name: post.author_name || post.author || blogConfig.defaultAuthor,
      status: post.status === 'published' ? 'published' : 'draft',
      featured_image: post.featured_image || '',
      tags: Array.isArray(post.tags) ? post.tags : [],
    });
    const linkedIg = socialPosts.find(
      (sp) => String(sp.blogId) === String(post.id) && sp.platform === 'instagram'
    );
    const linkedFb = socialPosts.find(
      (sp) => String(sp.blogId) === String(post.id) && sp.platform === 'facebook'
    );
    setComposerInstagramEnabled(true);
    setComposerFacebookEnabled(true);
    setCustomizeSocialCaptions(Boolean(linkedIg?.customEdited || linkedFb?.customEdited));
    setCustomInstagramCaption(linkedIg?.caption || '');
    setCustomFacebookCaption(linkedFb?.caption || '');
    setIsPreviewMode(false);
    setIsComposing(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Permanently delete this article and its linked social posts?')) return;
    try {
      const res = await api.blog.delete(id);
      if (res.status === 'success') {
        await Promise.all([fetchBlogs(), fetchSocialPosts()]);
        if (readingPost?.id === id) setReadingPost(null);
        showToast('Article and linked social posts deleted.');
      }
    } catch (err: any) {
      alert(err.message || 'Delete failed.');
    }
  };

  const handleAIDraft = async () => {
    if (!aiTopic.trim()) return;
    setIsGenerating(true);
    try {
      const rawDraft = await generateBlogPostDraft(aiTopic);
      const nextTitle = aiTopic.trim();
      const fallbackContent =
        rawDraft && !rawDraft.includes('Failed to generate')
          ? rawDraft
          : `# ${nextTitle}\n\n## Executive Overview\n\nModern engineering organizations require resilient architecture, automated observability, and predictable delivery pipelines when implementing **${nextTitle}**.\n\n## Core Architectural Principles\n\n1. **Deterministic State Management**: Ensure idempotent operations across service boundaries.\n2. **Observability First**: Instrument latency, saturation, and error budgets before scaling traffic.\n3. **Zero-Downtime Rollouts**: Use progressive canary deployments with automated rollback triggers.\n\n## Implementation Blueprint\n\n\`\`\`typescript\nexport async function executePipeline(context: Record<string, unknown>) {\n  return { status: 'verified', timestamp: new Date().toISOString(), context };\n}\n\`\`\`\n\n## Key Takeaways\n\nAdopting a structured approach to ${nextTitle} reduces operational toil and accelerates production velocity.`;

      setCurrentBlog((prev) => ({
        ...prev,
        title: nextTitle,
        slug: generateSlug(nextTitle),
        excerpt: `An engineering deep-dive into ${nextTitle}, covering architecture patterns, reliability trade-offs, and production implementation.`,
        content: fallbackContent,
      }));
      showToast('DI AI drafted Blog + populated Instagram & Facebook captions.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddTag = () => {
    const cleaned = tagInput.trim();
    if (cleaned && !currentBlog.tags.includes(cleaned)) {
      setCurrentBlog((prev) => ({ ...prev, tags: [...prev.tags, cleaned] }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setCurrentBlog((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleSave = async (publishImmediately: boolean = false) => {
    if (!currentBlog.title.trim() || savingLockRef.current) return;
    savingLockRef.current = true;
    setIsSavingPost(true);
    const targetStatus = publishImmediately ? 'published' : currentBlog.status;
    const socialOptions = {
      enableInstagram: composerInstagramEnabled,
      enableFacebook: composerFacebookEnabled,
      instagramCaption: customizeSocialCaptions ? customInstagramCaption : undefined,
      facebookCaption: customizeSocialCaptions ? customFacebookCaption : undefined,
      imageUrl: currentBlog.featured_image || '',
      forceOverwrite: !customizeSocialCaptions,
      forcePublish: publishImmediately,
    };

    const payload = {
      ...currentBlog,
      slug: currentBlog.slug.trim() || generateSlug(currentBlog.title),
      status: targetStatus,
      socialOptions,
    };

    try {
      let apiRes: any = null;
      if (editingId) {
        apiRes = await api.blog.update({ id: editingId, ...payload });
        if (apiRes.status !== 'success') throw new Error(apiRes.message);
      } else {
        apiRes = await api.blog.create(payload);
        if (apiRes.status !== 'success') throw new Error(apiRes.message);
      }

      await Promise.all([fetchBlogs(), fetchSocialPosts()]);
      setIsComposing(false);
      setEditingId(null);

      const warnings: string[] = apiRes?.data?.socialWarnings || [];
      if (warnings.length > 0 && targetStatus === 'published') {
        setError(`Blog published live, but social live dispatch reported: ${warnings.join(' • ')}`);
      } else {
        setError(null);
      }

      showToast(
        apiRes?.message ||
          (targetStatus === 'published'
            ? 'Published across Website, Instagram & Facebook.'
            : 'Saved across Blog, Instagram & Facebook.')
      );
    } catch (err: any) {
      setError(err.message || 'Failed to save article.');
    } finally {
      savingLockRef.current = false;
      setIsSavingPost(false);
    }
  };

  const handleSyncToSite = async (id: string) => {
    setIsSyncing(id);
    try {
      const res = await api.blog.sync(id);
      await Promise.all([fetchBlogs(), fetchSocialPosts()]);
      showToast(res.message || 'Published & synced across Website, Instagram & Facebook.');
    } catch (err: any) {
      alert(err.message || 'Sync failed.');
    } finally {
      setIsSyncing(null);
    }
  };

  const handleToggleStatus = async (blog: any) => {
    const nextStatus = blog.status === 'published' ? 'draft' : 'published';
    if (nextStatus === 'published') {
      await handleSyncToSite(blog.id);
    } else {
      try {
        await api.blog.update({ id: blog.id, status: 'draft' });
        await Promise.all([fetchBlogs(), fetchSocialPosts()]);
        showToast('Article moved to Drafts.');
      } catch (err) {
        console.error(err);
      }
    }
  };

  const openNewSocialModal = (defaultPlatform?: SocialPlatform) => {
    setSocialDraft({
      platforms: defaultPlatform ? [defaultPlatform] : ['instagram', 'facebook'],
      title: '',
      caption: '',
      imageUrl: '',
      articleUrl: blogConfig.siteUrl || 'https://devinquire.com',
      category: blogConfig.categories[0] || 'Engineering',
      hashtagsText: (socialConfig.defaultHashtags || []).join(', '),
      status: 'draft',
    });
    setShowSocialComposerModal(true);
  };

  const openEditSocialModal = (post: SocialPost) => {
    setSocialDraft({
      id: post.id,
      platforms: [post.platform],
      title: post.title || '',
      caption: post.caption || '',
      imageUrl: post.imageUrl || '',
      articleUrl: post.articleUrl || blogConfig.siteUrl || 'https://devinquire.com',
      category: post.category || 'Engineering',
      hashtagsText: Array.isArray(post.hashtags) ? post.hashtags.join(', ') : '',
      status: post.status === 'published' ? 'published' : 'draft',
    });
    setShowSocialComposerModal(true);
  };

  const handleSaveSocialModal = async (publishNow: boolean = false) => {
    if (!socialDraft.caption.trim() && !socialDraft.title.trim()) return;
    if (socialDraft.platforms.length === 0) return;

    setIsSavingSocialPost(true);
    try {
      const hashtags = socialDraft.hashtagsText
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#+/, '').trim())
        .filter(Boolean);

      const res = await api.blog.saveSocial({
        id: socialDraft.id,
        platforms: socialDraft.platforms,
        platform: socialDraft.platforms[0],
        title: socialDraft.title || socialDraft.caption.split('\n')[0].slice(0, 100),
        caption: socialDraft.caption,
        imageUrl: socialDraft.imageUrl,
        articleUrl: socialDraft.articleUrl,
        category: socialDraft.category,
        hashtags,
        status: publishNow ? 'published' : socialDraft.status,
        publishNow,
      });
      if (res.status === 'success') {
        await fetchSocialPosts();
        setShowSocialComposerModal(false);
        showToast(
          publishNow
            ? `Published to ${socialDraft.platforms.map((p) => (p === 'instagram' ? 'Instagram' : 'Facebook')).join(' & ')}.`
            : 'Social post saved.'
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save social post.');
    } finally {
      setIsSavingSocialPost(false);
    }
  };

  const handlePublishSocialPost = async (post: SocialPost) => {
    if (socialPublishLockRef.current) return;
    socialPublishLockRef.current = true;
    setPublishingSocialId(post.id);
    setError(null);
    try {
      const res = await api.blog.publishSocial(post.id);
      if (res.status === 'success') {
        await fetchSocialPosts();
        showToast(
          res.message ||
            `${post.platform === 'instagram' ? 'Instagram' : 'Facebook'} post published live!`
        );
      }
    } catch (err: any) {
      await fetchSocialPosts();
      setError(err.message || 'Failed to publish social post.');
    } finally {
      socialPublishLockRef.current = false;
      setPublishingSocialId(null);
    }
  };

  const handleDeleteSocialPost = async (id: string) => {
    if (!window.confirm('Delete this social post from Editorial Studio?')) return;
    try {
      const res = await api.blog.deleteSocial(id);
      if (res.status === 'success') {
        await fetchSocialPosts();
        showToast('Social post deleted.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete social post.');
    }
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      showToast(`${label} copied to clipboard.`);
    });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const res = await api.blog.updateConfig(blogConfig);
      if (res.status === 'success' && res.data) {
        setBlogConfig({ ...DEFAULT_BLOG_CONFIG, ...res.data });
      }
      setShowConfigModal(false);
      showToast('Editorial Studio configuration saved.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveSocialConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSocialConfig(true);
    setSocialModalNotice(null);
    try {
      const res = await api.blog.saveSocialConfig(socialConfig);
      if (res.status === 'success' && res.data) {
        setSocialConfig((prev) => ({ ...prev, ...res.data }));
      }
      setShowSocialConfigModal(false);
      showToast('Instagram & Facebook automation settings saved.');
    } catch (err: any) {
      setSocialModalNotice({
        type: 'error',
        text: err?.message || 'Failed to save settings.',
      });
    } finally {
      setIsSavingSocialConfig(false);
    }
  };

  const handleConnectMetaOAuth = async (mode: 'popup' | 'redirect' = 'popup') => {
    setSocialModalNotice(null);
    setIsConnectingOAuth(true);
    try {
      const res = await api.blog.getMetaOAuthUrl({
        metaAppId: (socialConfig.metaAppId || '').trim(),
        metaAppSecret: (socialConfig.metaAppSecret || '').trim(),
        metaConfigId: (socialConfig.metaConfigId || '').trim(),
        oauthScopeMode: socialConfig.oauthScopeMode || 'instagram_and_facebook',
        includeBusinessManagement: Boolean(socialConfig.includeBusinessManagement),
        redirectOrigin: window.location.origin,
        mode,
      });
      if (res.status === 'success' && res.data?.authUrl) {
        if (mode === 'redirect') {
          window.location.href = res.data.authUrl;
          return;
        }
        const popup = window.open(
          res.data.authUrl,
          'di_meta_oauth',
          'width=620,height=720,menubar=no,toolbar=no,status=no'
        );
        if (!popup) {
          // Automatically fall back to same-tab redirect if browser blocked the popup
          const fallbackRes = await api.blog.getMetaOAuthUrl({
            metaAppId: (socialConfig.metaAppId || '').trim(),
            metaAppSecret: (socialConfig.metaAppSecret || '').trim(),
            metaConfigId: (socialConfig.metaConfigId || '').trim(),
            oauthScopeMode: socialConfig.oauthScopeMode || 'instagram_and_facebook',
            includeBusinessManagement: Boolean(socialConfig.includeBusinessManagement),
            redirectOrigin: window.location.origin,
            mode: 'redirect',
          });
          if (fallbackRes.status === 'success' && fallbackRes.data?.authUrl) {
            window.location.href = fallbackRes.data.authUrl;
            return;
          }
          setIsConnectingOAuth(false);
          setSocialModalNotice({
            type: 'error',
            text: 'Popup blocked. Click "Use Full-Page Redirect" right below.',
          });
          return;
        }

        // Poll popup close so UI refreshes even if cross-window events are blocked
        const pollTimer = window.setInterval(async () => {
          if (popup.closed) {
            window.clearInterval(pollTimer);
            setIsConnectingOAuth(false);
            await fetchSocialConfig();
          }
        }, 1500);
      } else {
        setIsConnectingOAuth(false);
        setSocialModalNotice({
          type: 'error',
          text: res.message || 'Enter Meta App ID & App Secret first.',
        });
      }
    } catch (err: any) {
      setIsConnectingOAuth(false);
      setSocialModalNotice({
        type: 'error',
        text: err?.message || 'Could not start Meta OAuth login.',
      });
    }
  };

  const handleQuickDiscoverToken = async () => {
    if (!quickConnectToken.trim()) {
      setSocialModalNotice({
        type: 'error',
        text: 'Paste your Meta User or Page Access Token first.',
      });
      return;
    }
    setSocialModalNotice(null);
    setIsDiscoveringToken(true);
    try {
      const res = await api.blog.discoverMetaAccounts({
        accessToken: quickConnectToken.trim(),
        metaAppId: socialConfig.metaAppId || '',
        metaAppSecret: socialConfig.metaAppSecret || '',
      });
      if (res.status === 'success' && res.data) {
        setSocialConfig((prev) => ({ ...prev, ...res.data }));
        setQuickConnectToken('');
        setSocialModalNotice({
          type: 'success',
          text: res.message || 'Facebook Page & Instagram discovered and connected.',
        });
        showToast(res.message || 'Connected Facebook Page & Instagram.');
      }
    } catch (err: any) {
      setSocialModalNotice({
        type: 'error',
        text: err?.message || 'Token auto-discovery failed.',
      });
    } finally {
      setIsDiscoveringToken(false);
    }
  };

  const handleSelectConnectedPage = async (pageId: string) => {
    setSocialModalNotice(null);
    try {
      const res = await api.blog.selectMetaPage(pageId);
      if (res.status === 'success' && res.data) {
        setSocialConfig((prev) => ({ ...prev, ...res.data }));
        setSocialModalNotice({
          type: 'success',
          text: res.message || 'Switched active Facebook Page.',
        });
      }
    } catch (err: any) {
      setSocialModalNotice({
        type: 'error',
        text: err?.message || 'Failed to switch page.',
      });
    }
  };

  const handleVerifySocialConnection = async () => {
    setSocialModalNotice(null);
    setIsVerifyingConnection(true);
    try {
      const res = await api.blog.verifySocialConnection(socialConfig);
      if (res.status === 'success') {
        await fetchSocialConfig();
        setSocialModalNotice({
          type: 'success',
          text: `Verified live: ${res.message}`,
        });
        showToast(`Verified: ${res.message}`);
      }
    } catch (err: any) {
      setSocialModalNotice({
        type: 'error',
        text: err?.message || 'Live connection verification failed.',
      });
    } finally {
      setIsVerifyingConnection(false);
    }
  };

  const handleDisconnectSocial = async () => {
    if (!window.confirm('Disconnect linked Facebook Page and Instagram account?')) return;
    setSocialModalNotice(null);
    setIsDisconnecting(true);
    try {
      const res = await api.blog.disconnectSocialAccounts();
      if (res.status === 'success' && res.data) {
        setSocialConfig((prev) => ({ ...prev, ...res.data }));
        setSocialModalNotice({
          type: 'success',
          text: 'Disconnected Facebook Page & Instagram account.',
        });
        showToast('Disconnected Facebook Page & Instagram.');
      }
    } catch (err: any) {
      setSocialModalNotice({
        type: 'error',
        text: err?.message || 'Failed to disconnect.',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleAddSocialHashtag = () => {
    const cleaned = socialHashtagInput.trim().replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '');
    if (cleaned && !socialConfig.defaultHashtags.includes(cleaned)) {
      setSocialConfig((prev) => ({
        ...prev,
        defaultHashtags: [...prev.defaultHashtags, cleaned],
      }));
      setSocialHashtagInput('');
    }
  };

  const handleRemoveSocialHashtag = (tag: string) => {
    setSocialConfig((prev) => ({
      ...prev,
      defaultHashtags: prev.defaultHashtags.filter((t) => t !== tag),
    }));
  };

  const handleAddCategory = () => {
    const cleaned = newCategoryInput.trim();
    if (cleaned && !blogConfig.categories.includes(cleaned)) {
      setBlogConfig((prev) => ({
        ...prev,
        categories: [...prev.categories, cleaned],
      }));
      setNewCategoryInput('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    if (blogConfig.categories.length <= 1) return;
    setBlogConfig((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c !== cat),
    }));
  };

  const instagramPosts = useMemo(
    () => socialPosts.filter((p) => p.platform === 'instagram'),
    [socialPosts]
  );

  const facebookPosts = useMemo(
    () => socialPosts.filter((p) => p.platform === 'facebook'),
    [socialPosts]
  );

  const filteredBlogs = useMemo(() => {
    return blogs.filter((b) => {
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchesCategory = categoryFilter === 'All' || b.category === categoryFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        String(b.title || '').toLowerCase().includes(q) ||
        String(b.excerpt || '').toLowerCase().includes(q) ||
        String(b.category || '').toLowerCase().includes(q) ||
        (Array.isArray(b.tags) && b.tags.some((t: string) => t.toLowerCase().includes(q)));
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [blogs, statusFilter, categoryFilter, searchQuery]);

  const filteredSocialPosts = useMemo(() => {
    if (activeChannel === 'blog') return [];
    const base = activeChannel === 'instagram' ? instagramPosts : facebookPosts;
    return base.filter((sp) => {
      const matchesStatus = statusFilter === 'all' || sp.status === statusFilter;
      const matchesCategory =
        categoryFilter === 'All' || (sp.category || 'Engineering') === categoryFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        String(sp.title || '').toLowerCase().includes(q) ||
        String(sp.caption || '').toLowerCase().includes(q) ||
        (Array.isArray(sp.hashtags) && sp.hashtags.some((h) => h.toLowerCase().includes(q)));
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [activeChannel, instagramPosts, facebookPosts, statusFilter, categoryFilter, searchQuery]);

  const stats = useMemo(() => {
    const published = blogs.filter((b) => b.status === 'published').length;
    const drafts = blogs.filter((b) => b.status !== 'published').length;
    const igLive = instagramPosts.filter((p) => p.status === 'published').length;
    const fbLive = facebookPosts.filter((p) => p.status === 'published').length;
    return {
      total: blogs.length,
      published,
      drafts,
      igTotal: instagramPosts.length,
      igLive,
      igDrafts: instagramPosts.length - igLive,
      fbTotal: facebookPosts.length,
      fbLive,
      fbDrafts: facebookPosts.length - fbLive,
      categories: blogConfig.categories.length,
    };
  }, [blogs, instagramPosts, facebookPosts, blogConfig.categories]);

  const activeCounts = useMemo(() => {
    if (activeChannel === 'instagram') {
      return { total: stats.igTotal, published: stats.igLive, drafts: stats.igDrafts };
    }
    if (activeChannel === 'facebook') {
      return { total: stats.fbTotal, published: stats.fbLive, drafts: stats.fbDrafts };
    }
    return { total: stats.total, published: stats.published, drafts: stats.drafts };
  }, [activeChannel, stats]);

  const formatMarkdown = (text: string) => {
    if (!text) return '<p class="text-[var(--apple-text-tertiary)] italic">No content written yet…</p>';
    return text
      .replace(
        /^### (.*$)/gim,
        '<h3 class="text-[18px] font-semibold text-[var(--apple-text-primary)] mt-5 mb-2">$1</h3>'
      )
      .replace(
        /^## (.*$)/gim,
        '<h2 class="text-[22px] font-semibold text-[var(--apple-text-primary)] mt-6 mb-3 border-b border-[var(--apple-border)] pb-2">$1</h2>'
      )
      .replace(
        /^# (.*$)/gim,
        '<h1 class="text-[26px] font-bold text-[var(--apple-text-primary)] mt-6 mb-4">$1</h1>'
      )
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold text-[var(--apple-text-primary)]">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
      .replace(
        /`(.*?)`/gim,
        '<code class="px-1.5 py-0.5 rounded bg-[#4e45e1]/10 text-[var(--apple-blue)] font-mono text-[12px]">$1</code>'
      )
      .replace(/\n\n/gim, '</p><p class="mb-4 leading-relaxed text-[var(--apple-text-secondary)]">')
      .replace(/\n/gim, '<br />');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1440px] w-full mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--apple-blue)]">
              Omnichannel Publishing &amp; Social Automation
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]">
              {socialConfig.autoPopulateInstagram || socialConfig.autoPopulateFacebook
                ? 'Blog → IG & FB Auto-Sync'
                : 'Manual Sync'}
            </span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-[var(--apple-text-primary)] leading-tight">
            Editorial Studio
          </h1>
          <p className="text-[14px] text-[var(--apple-text-secondary)] mt-0.5 max-w-2xl">
            Write once and automatically populate the same content across your{' '}
            <strong>Website Blog</strong>, <strong>Instagram</strong>, and <strong>Facebook</strong>{' '}
            with scheduled automation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center flex-wrap">
          <button
            onClick={() => setShowAutomationPanel((prev) => !prev)}
            className={`h-10 px-4 rounded-[12px] text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap border transition ${
              showAutomationPanel
                ? 'bg-[#4e45e1]/12 border-[#4e45e1]/30 text-[var(--apple-blue)]'
                : 'apple-secondary-btn border-transparent'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                automationConfig.enabled ? 'bg-[#28CD41]' : 'bg-[var(--apple-text-tertiary)]/50'
              }`}
            />
            <i className="fas fa-bolt text-[var(--apple-blue)] text-xs shrink-0"></i>
            <span>Content Automation</span>
          </button>

          <button
            onClick={() => {
              setSocialModalNotice(null);
              setShowSocialConfigModal(true);
            }}
            className="h-10 px-4 apple-secondary-btn rounded-[12px] text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                (socialConfig.facebookPageId && socialConfig.facebookAccessToken) ||
                (socialConfig.instagramAccountId && socialConfig.instagramAccessToken) ||
                socialConfig.webhookUrl
                  ? 'bg-[#28CD41]'
                  : 'bg-[#FF9500]'
              }`}
            />
            <span className="inline-flex items-center -space-x-1">
              <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center">
                <InstagramIcon className="w-2.5 h-2.5" />
              </span>
              <span className="w-4 h-4 rounded-full bg-[#1877F2] text-white flex items-center justify-center">
                <FacebookIcon className="w-2.5 h-2.5" />
              </span>
            </span>
            <span>
              {(socialConfig.facebookPageId && socialConfig.facebookAccessToken) ||
              (socialConfig.instagramAccountId && socialConfig.instagramAccessToken)
                ? 'IG & FB Connected'
                : 'Connect IG & FB'}
            </span>
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="h-10 px-3.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap"
            title="Blog Settings"
          >
            <i className="fas fa-sliders text-[var(--apple-blue)] text-xs shrink-0"></i>
            <span>Blog Settings</span>
          </button>

          {!isComposing && (
            <button
              onClick={openNewComposer}
              className="h-10 px-4 apple-pill-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i className="fas fa-plus text-xs badge-white shrink-0"></i>
              <span>New Omnichannel Post</span>
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="p-3.5 bg-[#28CD41]/12 border border-[#28CD41]/25 text-[#248A3D] dark:text-[#30D158] rounded-[12px] text-[13px] font-medium flex items-center gap-2.5">
          <i className="fas fa-circle-check"></i>
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] rounded-[14px] text-[13px] flex items-center gap-2.5">
          <i className="fas fa-circle-exclamation"></i>
          <span>{error}</span>
        </div>
      )}

      {/* Omnichannel Automation Workflow Panel */}
      {showAutomationPanel && (
        <div className="apple-card p-5 space-y-4 border border-[#4e45e1]/20 animate-in fade-in duration-300">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] font-semibold text-[var(--apple-text-primary)]">
                  Omnichannel Content &amp; Social Automation Workflow
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    automationConfig.enabled
                      ? 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]'
                      : 'bg-[var(--apple-bg-tertiary)] text-[var(--apple-text-secondary)]'
                  }`}
                >
                  {automationConfig.enabled ? 'Scheduled Active' : 'Manual Trigger'}
                </span>
              </div>
              <p className="text-[12.5px] text-[var(--apple-text-secondary)] mt-0.5">
                Pull tech stories from <strong>daily.dev</strong> or sync your existing articles so{' '}
                <strong>Blog</strong>, <strong>Instagram</strong>, and <strong>Facebook</strong> are
                automatically populated with the same content, formatted captions, and hashtags.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                disabled={isPopulatingSocial}
                onClick={() => handlePopulateAllSocial(false)}
                className="h-9 px-3.5 apple-secondary-btn rounded-[10px] text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-60"
              >
                <i
                  className={`fas ${
                    isPopulatingSocial ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'
                  } text-[var(--apple-blue)] text-xs`}
                ></i>
                <span>
                  {isPopulatingSocial ? 'Populating…' : 'Sync Existing Blogs → IG & FB'}
                </span>
              </button>
              <button
                type="button"
                disabled={isSavingAutomation}
                onClick={handleSaveAutomation}
                className="h-9 px-3.5 apple-secondary-btn rounded-[10px] text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-60"
              >
                <i
                  className={`fas ${
                    isSavingAutomation ? 'fa-spinner fa-spin' : 'fa-floppy-disk'
                  } text-xs`}
                ></i>
                <span>{isSavingAutomation ? 'Saving…' : 'Save Workflow'}</span>
              </button>
              <button
                type="button"
                disabled={isRunningAutomation}
                onClick={handleRunAutomationNow}
                className="h-9 px-4 apple-pill-btn rounded-[10px] text-[12.5px] font-semibold inline-flex items-center gap-2 disabled:opacity-60"
              >
                <i
                  className={`fas ${
                    isRunningAutomation ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-down'
                  } text-xs badge-white`}
                ></i>
                <span>
                  {isRunningAutomation
                    ? 'Populating Blog, IG & FB…'
                    : 'Pull & Populate All Channels'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
            <label className="apple-subcard p-3 rounded-[12px] space-y-1.5 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                Category Mapping
              </span>
              <select
                value={automationConfig.categoryOverride}
                onChange={(e) =>
                  setAutomationConfig((prev) => ({ ...prev, categoryOverride: e.target.value }))
                }
                className="w-full apple-input px-2.5 py-1.5 text-[13px] rounded-[8px]"
              >
                <option value="Auto">Auto-Categorize by Topic</option>
                {blogConfig.categories.map((cat) => (
                  <option key={cat} value={cat}>
                    Force: {cat}
                  </option>
                ))}
              </select>
            </label>

            <label className="apple-subcard p-3 rounded-[12px] space-y-1.5 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                Articles Per Pull
              </span>
              <select
                value={automationConfig.maxPerRun}
                onChange={(e) =>
                  setAutomationConfig((prev) => ({ ...prev, maxPerRun: Number(e.target.value) }))
                }
                className="w-full apple-input px-2.5 py-1.5 text-[13px] rounded-[8px]"
              >
                <option value={5}>5 articles</option>
                <option value={10}>10 articles</option>
                <option value={15}>15 articles</option>
                <option value={20}>20 articles</option>
              </select>
            </label>

            <label className="apple-subcard p-3 rounded-[12px] space-y-1.5 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                Post Status
              </span>
              <select
                value={automationConfig.autoPublish ? 'published' : 'draft'}
                onChange={(e) =>
                  setAutomationConfig((prev) => ({
                    ...prev,
                    autoPublish: e.target.value === 'published',
                  }))
                }
                className="w-full apple-input px-2.5 py-1.5 text-[13px] rounded-[8px]"
              >
                <option value="published">Publish Immediately</option>
                <option value="draft">Save as Draft for Review</option>
              </select>
            </label>

            <div className="apple-subcard p-3 rounded-[12px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                  IG &amp; FB Auto-Populate
                </span>
                <input
                  type="checkbox"
                  checked={automationConfig.autoPopulateSocial !== false}
                  onChange={(e) =>
                    setAutomationConfig((prev) => ({
                      ...prev,
                      autoPopulateSocial: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-[#4e45e1] cursor-pointer"
                />
              </div>
              <p className="text-[11.5px] text-[var(--apple-text-secondary)] leading-snug pt-0.5">
                {automationConfig.autoPopulateSocial !== false
                  ? 'Populates Blog + Instagram + Facebook'
                  : 'Blog articles only'}
              </p>
            </div>

            <div className="apple-subcard p-3 rounded-[12px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                  Auto-Schedule
                </span>
                <input
                  type="checkbox"
                  checked={automationConfig.enabled}
                  onChange={(e) =>
                    setAutomationConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#4e45e1] cursor-pointer"
                />
              </div>
              <select
                disabled={!automationConfig.enabled}
                value={automationConfig.intervalMinutes}
                onChange={(e) =>
                  setAutomationConfig((prev) => ({
                    ...prev,
                    intervalMinutes: Number(e.target.value),
                  }))
                }
                className="w-full apple-input px-2.5 py-1.5 text-[13px] rounded-[8px] disabled:opacity-50"
              >
                <option value={60}>Every 1 hour</option>
                <option value={360}>Every 6 hours</option>
                <option value={720}>Every 12 hours</option>
                <option value={1440}>Every 24 hours</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--apple-text-tertiary)] pt-1 border-t border-[var(--apple-border)]">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                <strong>Last Run:</strong>{' '}
                {automationConfig.lastRunAt
                  ? new Date(automationConfig.lastRunAt).toLocaleString()
                  : 'Never'}
              </span>
              <span>
                <strong>Last Imported:</strong> {automationConfig.lastImportedCount} blogs,{' '}
                {automationConfig.lastSocialCount || 0} social posts (
                {automationConfig.lastSkippedCount} skipped)
              </span>
            </div>
            {automationConfig.lastError && (
              <span className="text-[#FF3B30]">Last error: {automationConfig.lastError}</span>
            )}
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => {
            setIsComposing(false);
            setActiveChannel('blog');
          }}
          className={`apple-card p-4 flex items-center justify-between cursor-pointer transition-all ${
            activeChannel === 'blog' ? 'border-[#4e45e1]/50 ring-1 ring-[#4e45e1]/20' : ''
          }`}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Website Blog
            </p>
            <p className="text-[22px] font-bold text-[var(--apple-text-primary)] mt-0.5">
              {stats.total}
            </p>
            <p className="text-[11px] text-[#248A3D] dark:text-[#30D158] font-medium">
              {stats.published} published • {stats.drafts} drafts
            </p>
          </div>
          <div className="w-10 h-10 rounded-[12px] bg-[#4e45e1]/12 text-[var(--apple-blue)] flex items-center justify-center">
            <i className="fas fa-newspaper text-sm"></i>
          </div>
        </div>

        <div
          onClick={() => {
            setIsComposing(false);
            setActiveChannel('instagram');
          }}
          className={`apple-card p-4 flex items-center justify-between cursor-pointer transition-all ${
            activeChannel === 'instagram' ? 'border-[#DD2A7B]/50 ring-1 ring-[#DD2A7B]/20' : ''
          }`}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Instagram Feed
            </p>
            <p className="text-[22px] font-bold text-[var(--apple-text-primary)] mt-0.5">
              {stats.igTotal}
            </p>
            <p className="text-[11px] text-[var(--apple-text-secondary)]">
              {stats.igLive} live • {socialConfig.instagramHandle}
            </p>
          </div>
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center shadow-sm">
            <InstagramIcon className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => {
            setIsComposing(false);
            setActiveChannel('facebook');
          }}
          className={`apple-card p-4 flex items-center justify-between cursor-pointer transition-all ${
            activeChannel === 'facebook' ? 'border-[#1877F2]/50 ring-1 ring-[#1877F2]/20' : ''
          }`}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Facebook Page
            </p>
            <p className="text-[22px] font-bold text-[var(--apple-text-primary)] mt-0.5">
              {stats.fbTotal}
            </p>
            <p className="text-[11px] text-[var(--apple-text-secondary)]">
              {stats.fbLive} live • {socialConfig.facebookPageName}
            </p>
          </div>
          <div className="w-10 h-10 rounded-[12px] bg-[#1877F2] text-white flex items-center justify-center shadow-sm">
            <FacebookIcon className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setShowSocialConfigModal(true)}
          className="apple-card p-4 flex items-center justify-between cursor-pointer hover:border-[var(--apple-blue)] transition-all"
        >
          <div className="min-w-0 pr-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Auto-Sync Pipeline
            </p>
            <p className="text-[15px] font-bold text-[var(--apple-text-primary)] mt-1 truncate">
              {socialConfig.webhookUrl ||
              (socialConfig.facebookPageId && socialConfig.facebookAccessToken) ||
              (socialConfig.instagramAccountId && socialConfig.instagramAccessToken)
                ? 'Live API Connected'
                : 'Auto-Populate Active'}
            </p>
            <p className="text-[11px] text-[var(--apple-blue)] font-medium mt-0.5">
              Configure Meta API / Webhook →
            </p>
          </div>
          <div className="w-10 h-10 rounded-[12px] bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158] flex items-center justify-center shrink-0">
            <i className="fas fa-share-nodes text-sm"></i>
          </div>
        </div>
      </div>

      {/* Omnichannel Switcher Bar */}
      {!isComposing && (
        <div className="apple-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center p-1 rounded-[12px] bg-black/[0.04] dark:bg-white/[0.06] border border-[var(--apple-border)] overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveChannel('blog')}
              className={`h-9 px-4 rounded-[9px] text-[13px] font-semibold inline-flex items-center gap-2 transition-all whitespace-nowrap ${
                activeChannel === 'blog'
                  ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
                  : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
              }`}
            >
              <i className={`fas fa-newspaper text-xs ${activeChannel === 'blog' ? 'badge-white' : ''}`}></i>
              <span>Blog</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeChannel === 'blog'
                    ? 'bg-white/20 text-white badge-white'
                    : 'bg-black/[0.06] dark:bg-white/[0.08] text-[var(--apple-text-tertiary)]'
                }`}
              >
                {stats.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChannel('instagram')}
              className={`h-9 px-4 rounded-[9px] text-[13px] font-semibold inline-flex items-center gap-2 transition-all whitespace-nowrap ${
                activeChannel === 'instagram'
                  ? 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white badge-white shadow-sm'
                  : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
              }`}
            >
              <InstagramIcon className="w-3.5 h-3.5" />
              <span>Instagram</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeChannel === 'instagram'
                    ? 'bg-white/25 text-white badge-white'
                    : 'bg-black/[0.06] dark:bg-white/[0.08] text-[var(--apple-text-tertiary)]'
                }`}
              >
                {stats.igTotal}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChannel('facebook')}
              className={`h-9 px-4 rounded-[9px] text-[13px] font-semibold inline-flex items-center gap-2 transition-all whitespace-nowrap ${
                activeChannel === 'facebook'
                  ? 'bg-[#1877F2] text-white badge-white shadow-sm'
                  : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
              }`}
            >
              <FacebookIcon className="w-3.5 h-3.5" />
              <span>Facebook</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeChannel === 'facebook'
                    ? 'bg-white/25 text-white badge-white'
                    : 'bg-black/[0.06] dark:bg-white/[0.08] text-[var(--apple-text-tertiary)]'
                }`}
              >
                {stats.fbTotal}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isDeduplicating}
              onClick={handleDeduplicatePosts}
              className="h-9 px-3 apple-secondary-btn rounded-[10px] text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              title="Remove any duplicate Blog, Instagram, or Facebook entries"
            >
              <i
                className={`fas ${
                  isDeduplicating ? 'fa-spinner fa-spin' : 'fa-broom'
                } text-[var(--apple-blue)] text-xs`}
              ></i>
              <span>{isDeduplicating ? 'Cleaning…' : 'Remove Duplicates'}</span>
            </button>

            <button
              type="button"
              disabled={isPopulatingSocial}
              onClick={() => handlePopulateAllSocial(false)}
              className="h-9 px-3.5 apple-secondary-btn rounded-[10px] text-[12px] font-semibold inline-flex items-center gap-2 disabled:opacity-50"
              title="Populate Instagram & Facebook with all Blog articles"
            >
              <i
                className={`fas ${
                  isPopulatingSocial ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'
                } text-[var(--apple-blue)] text-xs`}
              ></i>
              <span>{isPopulatingSocial ? 'Syncing…' : 'Populate IG & FB from Blogs'}</span>
            </button>

            {activeChannel !== 'blog' && (
              <button
                type="button"
                onClick={() => openNewSocialModal(activeChannel)}
                className="h-9 px-3.5 apple-pill-btn rounded-[10px] text-[12px] font-semibold inline-flex items-center gap-1.5"
              >
                <i className="fas fa-plus text-[11px] badge-white"></i>
                <span>
                  New {activeChannel === 'instagram' ? 'Instagram' : 'Facebook'} Post
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Article Composer (Omnichannel: Blog + Instagram + Facebook) */}
      {isComposing ? (
        <div className="apple-card p-6 sm:p-8 space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--apple-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[#4e45e1]/12 text-[var(--apple-blue)] flex items-center justify-center">
                <i className="fas fa-pen-nib"></i>
              </div>
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--apple-text-primary)]">
                  {editingId ? 'Edit Omnichannel Article' : 'Compose Omnichannel Article'}
                </h2>
                <p className="text-[12px] text-[var(--apple-text-secondary)]">
                  Write once — automatically populates Website Blog, Instagram, and Facebook with the same content.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="apple-subcard p-1 rounded-[10px] flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsPreviewMode(false)}
                  className={`px-3 py-1.5 rounded-[7px] text-[12px] font-semibold transition-all ${
                    !isPreviewMode
                      ? 'bg-[#4e45e1] text-white badge-white'
                      : 'text-[var(--apple-text-secondary)]'
                  }`}
                >
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewMode(true)}
                  className={`px-3 py-1.5 rounded-[7px] text-[12px] font-semibold transition-all ${
                    isPreviewMode
                      ? 'bg-[#4e45e1] text-white badge-white'
                      : 'text-[var(--apple-text-secondary)]'
                  }`}
                >
                  Preview All Channels
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsComposing(false);
                  setEditingId(null);
                }}
                className="px-3.5 py-2 apple-secondary-btn rounded-[10px] text-[12px] font-medium"
              >
                Cancel
              </button>
            </div>
          </div>

          {!isPreviewMode ? (
            <div className="space-y-5">
              {/* DI AI Co-Writer Bar */}
              <div className="apple-subcard p-4 rounded-[14px] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2 text-[var(--apple-blue)] text-[12px] font-semibold shrink-0">
                  <i className="fas fa-wand-magic-sparkles"></i>
                  <span>DI AI Omnichannel Assistant</span>
                </div>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Enter a topic to draft Blog + Instagram + Facebook content…"
                  className="flex-1 apple-input px-3.5 py-2 text-[13px]"
                />
                <button
                  type="button"
                  onClick={handleAIDraft}
                  disabled={isGenerating || !aiTopic.trim()}
                  className="px-4 py-2 apple-pill-btn rounded-[10px] text-[12px] font-semibold disabled:opacity-50 shrink-0"
                >
                  {isGenerating ? 'Drafting…' : 'Generate Draft'}
                </button>
              </div>

              {/* Title & Slug */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Headline (Shared across Blog, Instagram &amp; Facebook) *
                  </label>
                  <input
                    type="text"
                    value={currentBlog.title}
                    onChange={(e) => {
                      const nextTitle = e.target.value;
                      setCurrentBlog((prev) => ({
                        ...prev,
                        title: nextTitle,
                        slug: prev.slug ? prev.slug : generateSlug(nextTitle),
                      }));
                    }}
                    placeholder="Enter article headline…"
                    className="w-full apple-input px-4 py-2.5 text-[15px] font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={currentBlog.slug}
                    onChange={(e) =>
                      setCurrentBlog((prev) => ({ ...prev, slug: generateSlug(e.target.value) }))
                    }
                    placeholder="article-url-slug"
                    className="w-full apple-input px-3.5 py-2.5 text-[13px] font-mono"
                  />
                </div>
              </div>

              {/* Category, Author, Status, Featured Image */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Category
                  </label>
                  <select
                    value={currentBlog.category}
                    onChange={(e) =>
                      setCurrentBlog((prev) => ({ ...prev, category: e.target.value }))
                    }
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  >
                    {blogConfig.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Author Name
                  </label>
                  <input
                    type="text"
                    value={currentBlog.author_name}
                    onChange={(e) =>
                      setCurrentBlog((prev) => ({ ...prev, author_name: e.target.value }))
                    }
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Publication Status
                  </label>
                  <select
                    value={currentBlog.status}
                    onChange={(e) =>
                      setCurrentBlog((prev) => ({
                        ...prev,
                        status: e.target.value as 'draft' | 'published',
                      }))
                    }
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  >
                    <option value="draft">Draft (Internal Only)</option>
                    <option value="published">Published (Live Across Channels)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Cover / Social Image URL
                  </label>
                  <input
                    type="url"
                    value={currentBlog.featured_image}
                    onChange={(e) =>
                      setCurrentBlog((prev) => ({ ...prev, featured_image: e.target.value }))
                    }
                    placeholder="https://… (used for IG & FB)"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              {/* Excerpt & Tags */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Executive Summary / Social Lead
                  </label>
                  <textarea
                    rows={3}
                    value={currentBlog.excerpt}
                    onChange={(e) =>
                      setCurrentBlog((prev) => ({ ...prev, excerpt: e.target.value }))
                    }
                    placeholder="Concise summary used for blog cards, SEO meta, and social lead-in…"
                    className="w-full apple-input p-3 text-[13px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Tags &amp; Social Hashtags
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Add tag / hashtag and press Enter…"
                      className="flex-1 apple-input px-3.5 py-2 text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-3.5 py-2 apple-secondary-btn rounded-[10px] text-[12px] font-semibold"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {currentBlog.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#4e45e1]/10 text-[var(--apple-blue)]"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-[#FF3B30]"
                        >
                          <i className="fas fa-times text-[9px]"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Markdown Body */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Article Body (Markdown Supported — Auto-formatted into Plain Text for Instagram &amp; Facebook)
                </label>
                <textarea
                  rows={12}
                  value={currentBlog.content}
                  onChange={(e) =>
                    setCurrentBlog((prev) => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="# Introduction&#10;&#10;Write your article content in Markdown…"
                  className="w-full apple-input p-4 text-[13px] font-mono leading-relaxed"
                />
              </div>

              {/* Omnichannel Instagram & Facebook Auto-Population Panel */}
              <div className="apple-subcard p-5 rounded-[16px] space-y-4 border border-[#4e45e1]/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                        Automatic Instagram &amp; Facebook Population
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#4e45e1]/12 text-[var(--apple-blue)]">
                        Same Content Synced
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--apple-text-secondary)] mt-0.5">
                      Instagram and Facebook posts are automatically populated in real time from your article above.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="inline-flex items-center gap-2 text-[12.5px] font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={composerInstagramEnabled}
                        onChange={(e) => setComposerInstagramEnabled(e.target.checked)}
                        className="w-4 h-4 accent-[#DD2A7B]"
                      />
                      <InstagramIcon className="w-3.5 h-3.5 text-[#DD2A7B]" />
                      <span>Instagram</span>
                    </label>

                    <label className="inline-flex items-center gap-2 text-[12.5px] font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={composerFacebookEnabled}
                        onChange={(e) => setComposerFacebookEnabled(e.target.checked)}
                        className="w-4 h-4 accent-[#1877F2]"
                      />
                      <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2]" />
                      <span>Facebook</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        if (!customizeSocialCaptions) {
                          setCustomInstagramCaption(liveAutoInstagramCaption);
                          setCustomFacebookCaption(liveAutoFacebookCaption);
                        }
                        setCustomizeSocialCaptions((prev) => !prev);
                      }}
                      className="px-3 py-1.5 apple-secondary-btn rounded-[9px] text-[11.5px] font-semibold"
                    >
                      {customizeSocialCaptions ? 'Reset to Auto-Sync' : 'Customize Captions'}
                    </button>
                  </div>
                </div>

                {(composerInstagramEnabled || composerFacebookEnabled) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
                    {composerInstagramEnabled && (
                      <div className="apple-card p-4 space-y-2.5 border border-[#DD2A7B]/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center">
                              <InstagramIcon className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-[12.5px] font-semibold text-[var(--apple-text-primary)]">
                              Instagram ({socialConfig.instagramHandle})
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-[#DD2A7B]">
                            {customizeSocialCaptions ? 'Custom Caption' : 'Auto-Populated'}
                          </span>
                        </div>
                        <textarea
                          rows={6}
                          readOnly={!customizeSocialCaptions}
                          value={
                            customizeSocialCaptions
                              ? customInstagramCaption
                              : liveAutoInstagramCaption
                          }
                          onChange={(e) => setCustomInstagramCaption(e.target.value)}
                          className={`w-full apple-input p-3 text-[12px] leading-relaxed ${
                            !customizeSocialCaptions ? 'opacity-90' : ''
                          }`}
                        />
                      </div>
                    )}

                    {composerFacebookEnabled && (
                      <div className="apple-card p-4 space-y-2.5 border border-[#1877F2]/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-[#1877F2] text-white flex items-center justify-center">
                              <FacebookIcon className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-[12.5px] font-semibold text-[var(--apple-text-primary)]">
                              Facebook ({socialConfig.facebookPageName})
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-[#1877F2]">
                            {customizeSocialCaptions ? 'Custom Post' : 'Auto-Populated'}
                          </span>
                        </div>
                        <textarea
                          rows={6}
                          readOnly={!customizeSocialCaptions}
                          value={
                            customizeSocialCaptions
                              ? customFacebookCaption
                              : liveAutoFacebookCaption
                          }
                          onChange={(e) => setCustomFacebookCaption(e.target.value)}
                          className={`w-full apple-input p-3 text-[12px] leading-relaxed ${
                            !customizeSocialCaptions ? 'opacity-90' : ''
                          }`}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Blog Preview */}
              <div className="apple-subcard p-6 sm:p-8 rounded-[18px] space-y-5">
                <div className="space-y-2 border-b border-[var(--apple-border)] pb-5">
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#4e45e1]/12 text-[var(--apple-blue)]">
                    Website Blog • {currentBlog.category}
                  </span>
                  <h1 className="text-[26px] font-bold text-[var(--apple-text-primary)]">
                    {currentBlog.title || 'Untitled Article'}
                  </h1>
                  <p className="text-[13px] text-[var(--apple-text-secondary)]">
                    By {currentBlog.author_name} • /{currentBlog.slug || 'article-slug'}
                  </p>
                </div>
                <div
                  className="text-[14px] leading-relaxed text-[var(--apple-text-primary)]"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(currentBlog.content) }}
                />
              </div>

              {/* Instagram & Facebook Side-by-Side Live Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="apple-subcard p-5 rounded-[18px] space-y-3 border border-[#DD2A7B]/20">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center">
                      <InstagramIcon className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                        {socialConfig.instagramHandle}
                      </p>
                      <p className="text-[11px] text-[var(--apple-text-tertiary)]">
                        Instagram Feed Preview
                      </p>
                    </div>
                  </div>
                  <div className="rounded-[14px] overflow-hidden border border-[var(--apple-border)] bg-gradient-to-br from-[#4e45e1] via-[#7B61FF] to-[#DD2A7B] p-6 text-white min-h-[160px] flex flex-col justify-end">
                    <span className="text-[10px] uppercase tracking-widest font-bold opacity-85 badge-white">
                      {currentBlog.category}
                    </span>
                    <p className="text-[17px] font-bold leading-snug mt-1 badge-white">
                      {currentBlog.title || 'Untitled Article'}
                    </p>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-[12.5px] text-[var(--apple-text-secondary)] leading-relaxed">
                    {customizeSocialCaptions ? customInstagramCaption : liveAutoInstagramCaption}
                  </pre>
                </div>

                <div className="apple-subcard p-5 rounded-[18px] space-y-3 border border-[#1877F2]/20">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-[#1877F2] text-white flex items-center justify-center">
                      <FacebookIcon className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                        {socialConfig.facebookPageName}
                      </p>
                      <p className="text-[11px] text-[var(--apple-text-tertiary)]">
                        Facebook Page Preview
                      </p>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-[12.5px] text-[var(--apple-text-secondary)] leading-relaxed">
                    {customizeSocialCaptions ? customFacebookCaption : liveAutoFacebookCaption}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Save & Publish Footer */}
          <div className="pt-4 border-t border-[var(--apple-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-[var(--apple-text-secondary)] flex items-center gap-2">
              <i className="fas fa-bolt text-[var(--apple-blue)]"></i>
              <span>
                Target channels:{' '}
                <strong>
                  {[
                    'Website Blog',
                    composerInstagramEnabled ? 'Instagram' : null,
                    composerFacebookEnabled ? 'Facebook' : null,
                  ]
                    .filter(Boolean)
                    .join(' + ')}
                </strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isSavingPost || !currentBlog.title.trim()}
                onClick={() => handleSave(false)}
                className="px-5 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-semibold disabled:opacity-50"
              >
                {isSavingPost ? 'Saving…' : editingId ? 'Save All Channels' : 'Save Draft Across Channels'}
              </button>
              <button
                type="button"
                disabled={isSavingPost || !currentBlog.title.trim()}
                onClick={() => handleSave(true)}
                className="px-5 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <i className="fas fa-cloud-arrow-up text-xs badge-white"></i>
                <span>
                  {isSavingPost ? 'Publishing…' : 'Publish Blog + Instagram + Facebook'}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filter & Search Bar */}
          <div className="apple-card p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Status Segmented Control */}
              <div className="inline-flex items-center h-10 p-1 rounded-[11px] bg-black/[0.04] dark:bg-white/[0.06] border border-[var(--apple-border)]">
                {(
                  [
                    { key: 'all', label: 'All', count: activeCounts.total },
                    { key: 'published', label: 'Published', count: activeCounts.published },
                    { key: 'draft', label: 'Draft', count: activeCounts.drafts },
                  ] as const
                ).map((tab) => {
                  const active = statusFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key)}
                      className={`h-8 px-3.5 rounded-[8px] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                        active
                          ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
                          : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          active
                            ? 'bg-white/20 text-white badge-white'
                            : 'bg-black/[0.06] dark:bg-white/[0.08] text-[var(--apple-text-tertiary)]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Category Filter Select */}
              <div className="relative flex items-center">
                <i className="fas fa-layer-group absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--apple-blue)] text-[11px] pointer-events-none"></i>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                  className="apple-input h-10 pl-9 pr-9 text-[12px] font-semibold rounded-[11px] min-w-[165px]"
                >
                  <option value="All">All Categories</option>
                  {blogConfig.categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative w-full md:w-72">
              <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--apple-text-tertiary)] text-xs pointer-events-none"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeChannel === 'blog'
                    ? 'Search articles, categories, tags…'
                    : `Search ${activeChannel === 'instagram' ? 'Instagram' : 'Facebook'} posts & hashtags…`
                }
                className="w-full apple-input h-10 pl-9 pr-4 text-[13px] rounded-[11px]"
              />
            </div>
          </div>

          {/* BLOG ARTICLES VIEW */}
          {activeChannel === 'blog' ? (
            isLoading && blogs.length === 0 ? (
              <div className="apple-card p-12 text-center text-[13px] text-[var(--apple-text-secondary)]">
                Loading Editorial Studio articles…
              </div>
            ) : filteredBlogs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredBlogs.map((blog) => {
                  const hasIg = instagramPosts.some(
                    (sp) => String(sp.blogId) === String(blog.id)
                  );
                  const hasFb = facebookPosts.some(
                    (sp) => String(sp.blogId) === String(blog.id)
                  );
                  return (
                    <div
                      key={blog.id}
                      onClick={() => setReadingPost(blog)}
                      className="apple-card p-6 flex flex-col justify-between cursor-pointer hover:border-[var(--apple-blue)] transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#4e45e1]/10 text-[var(--apple-blue)]">
                              {blog.category || 'Engineering'}
                            </span>
                            {hasIg && (
                              <span
                                title="Populated on Instagram"
                                className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white inline-flex items-center justify-center"
                              >
                                <InstagramIcon className="w-3 h-3" />
                              </span>
                            )}
                            {hasFb && (
                              <span
                                title="Populated on Facebook"
                                className="w-6 h-6 rounded-full bg-[#1877F2] text-white inline-flex items-center justify-center"
                              >
                                <FacebookIcon className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleToggleStatus(blog)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase transition-all ${
                                blog.status === 'published'
                                  ? 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]'
                                  : 'bg-[#FF9500]/15 text-[#FF9500]'
                              }`}
                              title="Click to toggle Published / Draft status"
                            >
                              {blog.status === 'published' ? 'Published' : 'Draft'}
                            </button>
                            <button
                              onClick={() => handleEdit(blog)}
                              className="w-8 h-8 rounded-[9px] apple-subcard text-[var(--apple-text-secondary)] hover:text-[var(--apple-blue)] flex items-center justify-center"
                              title="Edit Omnichannel Article"
                            >
                              <i className="fas fa-pen text-xs"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(blog.id)}
                              className="w-8 h-8 rounded-[9px] apple-subcard text-[var(--apple-text-secondary)] hover:text-[#FF3B30] flex items-center justify-center"
                              title="Delete Article"
                            >
                              <i className="fas fa-trash-can text-xs"></i>
                            </button>
                          </div>
                        </div>

                        <h3 className="text-[18px] font-semibold text-[var(--apple-text-primary)] mb-2 line-clamp-2">
                          {blog.title}
                        </h3>
                        <p className="text-[13px] text-[var(--apple-text-secondary)] line-clamp-2 mb-4">
                          {blog.excerpt || 'Click to read or edit full article content.'}
                        </p>

                        {Array.isArray(blog.tags) && blog.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {blog.tags.map((tag: string) => (
                              <span
                                key={tag}
                                className="text-[11px] font-medium px-2 py-0.5 rounded-md apple-subcard text-[var(--apple-text-secondary)]"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div
                        className="pt-4 border-t border-[var(--apple-border)] flex items-center justify-between gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-[12px] text-[var(--apple-text-tertiary)] truncate">
                          <span className="font-medium text-[var(--apple-text-secondary)]">
                            {blog.author}
                          </span>{' '}
                          • {blog.date}
                        </div>

                        <button
                          onClick={() => handleSyncToSite(blog.id)}
                          disabled={isSyncing === blog.id}
                          className={`px-3.5 py-1.5 rounded-[9px] text-[12px] font-semibold flex items-center gap-1.5 transition-all ${
                            blog.status === 'published'
                              ? 'apple-secondary-btn text-[var(--apple-text-primary)]'
                              : 'apple-pill-btn'
                          }`}
                        >
                          <i
                            className={`fas ${
                              isSyncing === blog.id
                                ? 'fa-spinner fa-spin'
                                : blog.status === 'published'
                                ? 'fa-rotate'
                                : 'fa-cloud-arrow-up badge-white'
                            } text-[11px]`}
                          ></i>
                          <span>
                            {isSyncing === blog.id
                              ? 'Syncing…'
                              : blog.status === 'published'
                              ? 'Sync Web + IG + FB'
                              : 'Publish All Channels'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="apple-card p-14 text-center">
                <div className="max-w-sm mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#4e45e1]/10 text-[var(--apple-blue)] flex items-center justify-center mx-auto">
                    <i className="fas fa-pen-nib text-lg"></i>
                  </div>
                  <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                    No articles in Editorial Studio
                  </h3>
                  <p className="text-[13px] text-[var(--apple-text-secondary)]">
                    Create your first omnichannel article or pull from daily.dev to populate Blog, Instagram, and Facebook automatically.
                  </p>
                  <button
                    onClick={openNewComposer}
                    className="px-4 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center gap-2 mt-2"
                  >
                    <i className="fas fa-plus text-xs badge-white"></i>
                    <span>Create First Omnichannel Post</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            /* INSTAGRAM OR FACEBOOK FEED VIEW */
            <>
              {filteredSocialPosts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {filteredSocialPosts.map((post) => {
                    const isIg = post.platform === 'instagram';
                    return (
                      <div
                        key={post.id}
                        className="apple-card p-5 flex flex-col justify-between space-y-4 hover:border-[var(--apple-blue)] transition-all"
                      >
                        <div className="space-y-3.5">
                          {/* Platform Header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-full text-white flex items-center justify-center shrink-0 ${
                                  isIg
                                    ? 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]'
                                    : 'bg-[#1877F2]'
                                }`}
                              >
                                {isIg ? (
                                  <InstagramIcon className="w-4 h-4" />
                                ) : (
                                  <FacebookIcon className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13.5px] font-semibold text-[var(--apple-text-primary)] truncate">
                                  {post.accountHandle ||
                                    (isIg
                                      ? socialConfig.instagramHandle
                                      : socialConfig.facebookPageName)}
                                </p>
                                <div className="flex items-center gap-1.5 text-[11px] text-[var(--apple-text-tertiary)]">
                                  <span>{isIg ? 'Instagram Feed' : 'Facebook Page'}</span>
                                  {post.blogId && (
                                    <>
                                      <span>•</span>
                                      <span className="text-[var(--apple-blue)] font-medium">
                                        Synced from Blog
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${
                                  post.status === 'published'
                                    ? 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]'
                                    : 'bg-[#FF9500]/15 text-[#FF9500]'
                                }`}
                              >
                                {post.status === 'published' ? 'Published' : 'Draft'}
                              </span>
                              <button
                                onClick={() => openEditSocialModal(post)}
                                className="w-8 h-8 rounded-[9px] apple-subcard text-[var(--apple-text-secondary)] hover:text-[var(--apple-blue)] flex items-center justify-center"
                                title="Edit Social Post"
                              >
                                <i className="fas fa-pen text-xs"></i>
                              </button>
                              <button
                                onClick={() => handleDeleteSocialPost(post.id)}
                                className="w-8 h-8 rounded-[9px] apple-subcard text-[var(--apple-text-secondary)] hover:text-[#FF3B30] flex items-center justify-center"
                                title="Delete Social Post"
                              >
                                <i className="fas fa-trash-can text-xs"></i>
                              </button>
                            </div>
                          </div>

                          {/* Visual Media / Link Card */}
                          {post.imageUrl ? (
                            <div className="rounded-[14px] overflow-hidden border border-[var(--apple-border)] bg-black/5 aspect-[16/9] relative">
                              <img
                                src={post.imageUrl}
                                alt={post.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className={`rounded-[14px] p-5 text-white min-h-[135px] flex flex-col justify-between shadow-inner ${
                                isIg
                                  ? 'bg-gradient-to-br from-[#4e45e1] via-[#9B36B7] to-[#F58529]'
                                  : 'bg-gradient-to-br from-[#1877F2] via-[#2851A3] to-[#4e45e1]'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-white/20 badge-white">
                                  {post.category || 'Engineering'}
                                </span>
                                <span className="text-[11px] font-semibold opacity-85 badge-white">
                                  devinquire.com
                                </span>
                              </div>
                              <h4 className="text-[16px] font-bold leading-snug mt-3 line-clamp-2 badge-white">
                                {post.title}
                              </h4>
                            </div>
                          )}

                          {/* Caption Content */}
                          <p className="text-[13px] text-[var(--apple-text-secondary)] whitespace-pre-line line-clamp-5 leading-relaxed">
                            {post.caption}
                          </p>

                          {/* Hashtags */}
                          {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {post.hashtags.slice(0, 6).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[11px] font-medium px-2 py-0.5 rounded-md apple-subcard text-[var(--apple-blue)]"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {post.lastDispatchError && (
                            <div className="p-2.5 rounded-[10px] bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-[11.5px] leading-snug flex items-start gap-2">
                              <i className="fas fa-circle-exclamation mt-0.5 shrink-0"></i>
                              <span>{post.lastDispatchError}</span>
                            </div>
                          )}

                          {post.externalUrl && post.status === 'published' && (
                            <a
                              href={post.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#248A3D] dark:text-[#30D158] hover:underline"
                            >
                              <i className="fas fa-arrow-up-right-from-square text-[10px]"></i>
                              <span>
                                View Live Post on {isIg ? 'Instagram' : 'Facebook'}
                              </span>
                            </a>
                          )}
                        </div>

                        {/* Card Footer */}
                        <div className="pt-3.5 border-t border-[var(--apple-border)] flex items-center justify-between gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                post.caption,
                                `${isIg ? 'Instagram' : 'Facebook'} caption`
                              )
                            }
                            className="px-3 py-1.5 apple-secondary-btn rounded-[9px] text-[12px] font-medium inline-flex items-center gap-1.5"
                          >
                            <i className="fas fa-copy text-[11px]"></i>
                            <span>Copy Caption</span>
                          </button>

                          <button
                            type="button"
                            disabled={publishingSocialId === post.id}
                            onClick={() => handlePublishSocialPost(post)}
                            className={`px-3.5 py-1.5 rounded-[9px] text-[12px] font-semibold inline-flex items-center gap-1.5 ${
                              post.status === 'published' ? 'apple-secondary-btn' : 'apple-pill-btn'
                            }`}
                          >
                            <i
                              className={`fas ${
                                publishingSocialId === post.id
                                  ? 'fa-spinner fa-spin'
                                  : post.status === 'published'
                                  ? 'fa-paper-plane'
                                  : 'fa-bolt badge-white'
                              } text-[11px]`}
                            ></i>
                            <span>
                              {publishingSocialId === post.id
                                ? 'Publishing…'
                                : post.status === 'published'
                                ? 'Re-Dispatch'
                                : `Publish to ${isIg ? 'Instagram' : 'Facebook'}`}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="apple-card p-14 text-center">
                  <div className="max-w-md mx-auto space-y-3">
                    <div
                      className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center mx-auto ${
                        activeChannel === 'instagram'
                          ? 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]'
                          : 'bg-[#1877F2]'
                      }`}
                    >
                      {activeChannel === 'instagram' ? (
                        <InstagramIcon className="w-6 h-6" />
                      ) : (
                        <FacebookIcon className="w-6 h-6" />
                      )}
                    </div>
                    <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                      No {activeChannel === 'instagram' ? 'Instagram' : 'Facebook'} posts yet
                    </h3>
                    <p className="text-[13px] text-[var(--apple-text-secondary)]">
                      {blogs.length > 0
                        ? `You have ${blogs.length} blog article${
                            blogs.length === 1 ? '' : 's'
                          } ready to auto-populate into Instagram & Facebook with one click.`
                        : 'Write a new article in Editorial Studio or run daily.dev automation — Instagram & Facebook will automatically populate with the same content.'}
                    </p>
                    <div className="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
                      {blogs.length > 0 && (
                        <button
                          onClick={() => handlePopulateAllSocial(false)}
                          disabled={isPopulatingSocial}
                          className="px-4 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center gap-2"
                        >
                          <i className="fas fa-bolt text-xs badge-white"></i>
                          <span>
                            {isPopulatingSocial
                              ? 'Populating…'
                              : `Populate from ${blogs.length} Blog${blogs.length === 1 ? '' : 's'}`}
                          </span>
                        </button>
                      )}
                      <button
                        onClick={openNewComposer}
                        className="px-4 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center gap-2"
                      >
                        <i className="fas fa-plus text-xs"></i>
                        <span>Compose Omnichannel Article</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Article Reader Modal */}
      {readingPost && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setReadingPost(null)}
        >
          <div
            className="apple-glass rounded-[24px] w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#4e45e1]/12 text-[var(--apple-blue)]">
                  {readingPost.category}
                </span>
                <span className="text-[12px] text-[var(--apple-text-tertiary)]">
                  {readingPost.date} • By {readingPost.author}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const post = readingPost;
                    setReadingPost(null);
                    handleEdit(post);
                  }}
                  className="px-3 py-1.5 apple-secondary-btn rounded-[9px] text-[12px] font-medium"
                >
                  Edit Article &amp; Social
                </button>
                <button
                  onClick={() => setReadingPost(null)}
                  className="w-8 h-8 rounded-full apple-subcard text-[var(--apple-text-secondary)] flex items-center justify-center"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto space-y-5 flex-1">
              <h1 className="text-[26px] font-bold text-[var(--apple-text-primary)]">
                {readingPost.title}
              </h1>
              {readingPost.excerpt && (
                <p className="text-[14px] text-[var(--apple-text-secondary)] italic border-l-2 border-[var(--apple-blue)] pl-4">
                  {readingPost.excerpt}
                </p>
              )}
              <div
                className="text-[14px] leading-relaxed text-[var(--apple-text-primary)] pt-2"
                dangerouslySetInnerHTML={{ __html: formatMarkdown(readingPost.content || '') }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Standalone / Edit Social Post Modal */}
      {showSocialComposerModal && (
        <div className="fixed inset-0 z-[106] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                  {socialDraft.id ? 'Edit Social Post' : 'Create Instagram / Facebook Post'}
                </h3>
                <p className="text-[12px] text-[var(--apple-text-secondary)]">
                  Customize caption, media URL, and hashtags or publish across both channels.
                </p>
              </div>
              <button
                onClick={() => setShowSocialComposerModal(false)}
                className="w-8 h-8 rounded-full apple-subcard text-[var(--apple-text-secondary)] flex items-center justify-center"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {!socialDraft.id && (
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Target Channels
                  </label>
                  <div className="flex items-center gap-3">
                    {(['instagram', 'facebook'] as SocialPlatform[]).map((plt) => {
                      const checked = socialDraft.platforms.includes(plt);
                      return (
                        <button
                          key={plt}
                          type="button"
                          onClick={() => {
                            setSocialDraft((prev) => {
                              const next = checked
                                ? prev.platforms.filter((p) => p !== plt)
                                : [...prev.platforms, plt];
                              return { ...prev, platforms: next.length ? next : [plt] };
                            });
                          }}
                          className={`px-3.5 py-2 rounded-[10px] text-[12.5px] font-semibold inline-flex items-center gap-2 border transition ${
                            checked
                              ? 'bg-[#4e45e1]/12 border-[#4e45e1]/40 text-[var(--apple-blue)]'
                              : 'apple-subcard border-transparent text-[var(--apple-text-secondary)]'
                          }`}
                        >
                          {plt === 'instagram' ? (
                            <InstagramIcon className="w-3.5 h-3.5 text-[#DD2A7B]" />
                          ) : (
                            <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2]" />
                          )}
                          <span>{plt === 'instagram' ? 'Instagram' : 'Facebook'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Headline / Title
                </label>
                <input
                  type="text"
                  value={socialDraft.title}
                  onChange={(e) => setSocialDraft({ ...socialDraft, title: e.target.value })}
                  placeholder="Post headline…"
                  className="w-full apple-input px-3.5 py-2 text-[13px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Post Caption / Content *
                </label>
                <textarea
                  rows={6}
                  value={socialDraft.caption}
                  onChange={(e) => setSocialDraft({ ...socialDraft, caption: e.target.value })}
                  placeholder="Write your Instagram & Facebook post content…"
                  className="w-full apple-input p-3 text-[13px] leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Media / Image URL
                  </label>
                  <input
                    type="url"
                    value={socialDraft.imageUrl}
                    onChange={(e) => setSocialDraft({ ...socialDraft, imageUrl: e.target.value })}
                    placeholder="https://…"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Article / CTA Link
                  </label>
                  <input
                    type="url"
                    value={socialDraft.articleUrl}
                    onChange={(e) =>
                      setSocialDraft({ ...socialDraft, articleUrl: e.target.value })
                    }
                    placeholder="https://devinquire.com/blog/…"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Hashtags (comma separated)
                </label>
                <input
                  type="text"
                  value={socialDraft.hashtagsText}
                  onChange={(e) =>
                    setSocialDraft({ ...socialDraft, hashtagsText: e.target.value })
                  }
                  placeholder="DevInquire, Engineering, AI"
                  className="w-full apple-input px-3.5 py-2 text-[13px]"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  disabled={isSavingSocialPost}
                  onClick={() => handleSaveSocialModal(false)}
                  className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-semibold disabled:opacity-50"
                >
                  {isSavingSocialPost ? 'Saving…' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  disabled={isSavingSocialPost}
                  onClick={() => handleSaveSocialModal(true)}
                  className="flex-1 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold disabled:opacity-50"
                >
                  {isSavingSocialPost ? 'Publishing…' : 'Publish Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instagram & Facebook Automation & API Credentials Modal */}
      {showSocialConfigModal && (
        <div className="fixed inset-0 z-[106] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                  Instagram &amp; Facebook Omnichannel Automation
                </h3>
                <p className="text-[12px] text-[var(--apple-text-secondary)]">
                  Configure automatic content population rules, Meta Graph API tokens, or webhook automation (Make / Zapier / n8n).
                </p>
              </div>
              <button
                onClick={() => setShowSocialConfigModal(false)}
                className="w-8 h-8 rounded-full apple-subcard text-[var(--apple-text-secondary)] flex items-center justify-center"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <form
              onSubmit={handleSaveSocialConfig}
              className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
            >
              {socialModalNotice && (
                <div
                  className={`p-3.5 rounded-[12px] text-[12.5px] font-medium flex items-start gap-2.5 border ${
                    socialModalNotice.type === 'success'
                      ? 'bg-[#28CD41]/12 border-[#28CD41]/30 text-[#248A3D] dark:text-[#30D158]'
                      : 'bg-[#FF3B30]/10 border-[#FF3B30]/25 text-[#FF3B30]'
                  }`}
                >
                  <i
                    className={`fas ${
                      socialModalNotice.type === 'success'
                        ? 'fa-circle-check'
                        : 'fa-circle-exclamation'
                    } mt-0.5`}
                  ></i>
                  <span>{socialModalNotice.text}</span>
                </div>
              )}

              {/* Live Connected Status Card */}
              {((socialConfig.facebookPageId && socialConfig.facebookAccessToken) ||
                (socialConfig.instagramAccountId && socialConfig.instagramAccessToken)) && (
                <div className="apple-subcard p-4 rounded-[14px] space-y-3 border border-[#28CD41]/30 bg-[#28CD41]/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#28CD41] shadow-[0_0_8px_#28CD41]"></span>
                      <span className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                        Meta Accounts Connected
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isVerifyingConnection}
                        onClick={handleVerifySocialConnection}
                        className="px-3 py-1.5 apple-secondary-btn rounded-[8px] text-[11.5px] font-semibold inline-flex items-center gap-1.5"
                      >
                        <i
                          className={`fas ${
                            isVerifyingConnection ? 'fa-spinner fa-spin' : 'fa-plug-circle-check'
                          } text-[#28CD41] text-[11px]`}
                        ></i>
                        <span>{isVerifyingConnection ? 'Testing…' : 'Test Connection'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDisconnecting}
                        onClick={handleDisconnectSocial}
                        className="px-3 py-1.5 apple-secondary-btn rounded-[8px] text-[11.5px] font-semibold text-[#FF3B30] hover:bg-[#FF3B30]/10"
                      >
                        {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[12px]">
                    <div className="apple-card p-3 flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-[#1877F2] text-white flex items-center justify-center shrink-0">
                        <FacebookIcon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--apple-text-primary)] truncate">
                          {socialConfig.facebookPageName || 'Facebook Page'}
                        </p>
                        <p className="text-[11px] text-[var(--apple-text-tertiary)] truncate">
                          {socialConfig.facebookPageId
                            ? `Page ID: ${socialConfig.facebookPageId}`
                            : 'Not linked'}
                        </p>
                      </div>
                    </div>

                    <div className="apple-card p-3 flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center shrink-0">
                        <InstagramIcon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--apple-text-primary)] truncate">
                          {socialConfig.instagramAccountId
                            ? socialConfig.instagramHandle
                            : 'No Linked IG Business'}
                        </p>
                        <p className="text-[11px] text-[var(--apple-text-tertiary)] truncate">
                          {socialConfig.instagramAccountId
                            ? `IG ID: ${socialConfig.instagramAccountId}`
                            : 'Link IG to your FB Page in Meta'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {Array.isArray(socialConfig.connectedPages) &&
                    socialConfig.connectedPages.length > 1 && (
                      <div className="pt-1 space-y-1">
                        <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                          Switch Active Facebook Page &amp; Linked Instagram
                        </label>
                        <select
                          value={socialConfig.facebookPageId}
                          onChange={(e) => handleSelectConnectedPage(e.target.value)}
                          className="w-full apple-input px-3 py-2 text-[12.5px]"
                        >
                          {socialConfig.connectedPages.map((pg) => (
                            <option key={pg.pageId} value={pg.pageId}>
                              {pg.pageName}{' '}
                              {pg.instagramUsername
                                ? `(${pg.instagramUsername})`
                                : '(Facebook only)'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                </div>
              )}

              {/* Connect Facebook Page & Instagram Account Box */}
              <div className="apple-subcard p-4 rounded-[14px] space-y-4 border border-[#4e45e1]/25">
                <div>
                  <h4 className="text-[13.5px] font-semibold text-[var(--apple-text-primary)] flex items-center gap-2">
                    <i className="fas fa-link text-[var(--apple-blue)] text-xs"></i>
                    <span>Connect Your Facebook Page &amp; Instagram Business Account</span>
                  </h4>
                  <p className="text-[11.5px] text-[var(--apple-text-secondary)] mt-0.5">
                    Connect with <strong>1-Click Facebook OAuth Login</strong> (using your Meta App) or paste an Access Token from Meta Graph Explorer for instant auto-discovery.
                  </p>
                </div>

                {/* Option A: 1-Click OAuth Login */}
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                        Meta App ID
                      </label>
                      <input
                        type="text"
                        value={socialConfig.metaAppId || ''}
                        onChange={(e) =>
                          setSocialConfig({ ...socialConfig, metaAppId: e.target.value })
                        }
                        placeholder="e.g., 118492038471920"
                        className="w-full apple-input px-3 py-2 text-[12.5px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                        Meta App Secret
                      </label>
                      <input
                        type="password"
                        value={socialConfig.metaAppSecret || ''}
                        onChange={(e) =>
                          setSocialConfig({ ...socialConfig, metaAppSecret: e.target.value })
                        }
                        placeholder="App Secret from Meta App Basic Settings"
                        className="w-full apple-input px-3 py-2 text-[12.5px]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                        Permissions to Request
                      </label>
                      <select
                        value={socialConfig.oauthScopeMode || 'instagram_and_facebook'}
                        onChange={(e) =>
                          setSocialConfig({
                            ...socialConfig,
                            oauthScopeMode: e.target.value as
                              | 'instagram_and_facebook'
                              | 'facebook_only',
                          })
                        }
                        className="w-full apple-input px-3 py-2 text-[12px]"
                      >
                        <option value="instagram_and_facebook">
                          Facebook Page + Instagram Publishing
                        </option>
                        <option value="facebook_only">
                          Facebook Page Only (No Instagram Product Needed)
                        </option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                        Login Config ID (Optional — FB Login for Business)
                      </label>
                      <input
                        type="text"
                        value={socialConfig.metaConfigId || ''}
                        onChange={(e) =>
                          setSocialConfig({ ...socialConfig, metaConfigId: e.target.value })
                        }
                        placeholder="Leave blank unless using Login Config"
                        className="w-full apple-input px-3 py-2 text-[12px]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[var(--apple-text-tertiary)] bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2 rounded-[9px]">
                    <span className="truncate">
                      <strong>Valid OAuth Redirect URI:</strong>{' '}
                      <code className="font-mono text-[var(--apple-blue)]">
                        {typeof window !== 'undefined'
                          ? `${window.location.origin}/api/blog/social/oauth/callback`
                          : 'https://dashboard.devinquire.com/api/blog/social/oauth/callback'}
                      </code>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          `${window.location.origin}/api/blog/social/oauth/callback`,
                          'OAuth Redirect URI'
                        )
                      }
                      className="text-[var(--apple-blue)] font-semibold hover:underline shrink-0"
                    >
                      Copy URI
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={isConnectingOAuth}
                      onClick={() => handleConnectMetaOAuth('popup')}
                      className="flex-1 py-2.5 px-4 rounded-[11px] bg-[#1877F2] hover:bg-[#166FE5] text-white text-[13px] font-semibold flex items-center justify-center gap-2.5 shadow-sm transition disabled:opacity-60"
                    >
                      <FacebookIcon className="w-4 h-4" />
                      <span className="badge-white">
                        {isConnectingOAuth
                          ? 'Connecting with Facebook…'
                          : '1-Click Connect (Popup)'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={isConnectingOAuth}
                      onClick={() => handleConnectMetaOAuth('redirect')}
                      className="py-2.5 px-4 apple-secondary-btn rounded-[11px] text-[12.5px] font-semibold flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
                      title="Redirects in current tab — works even if browser blocks popups"
                    >
                      <i className="fas fa-arrow-right-to-bracket text-[#1877F2] text-xs"></i>
                      <span>Connect (Full-Page Redirect)</span>
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--apple-border)]"></div>
                  <span className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--apple-text-tertiary)]">
                    Or Instant Token Connect (No Redirect URI Needed)
                  </span>
                  <div className="h-px flex-1 bg-[var(--apple-border)]"></div>
                </div>

                {/* Option B: Quick Token Auto-Discovery */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    value={quickConnectToken}
                    onChange={(e) => setQuickConnectToken(e.target.value)}
                    placeholder="Paste User or Page Access Token from Graph API Explorer…"
                    className="flex-1 apple-input px-3.5 py-2 text-[12.5px]"
                  />
                  <button
                    type="button"
                    disabled={isDiscoveringToken}
                    onClick={handleQuickDiscoverToken}
                    className="px-4 py-2 apple-pill-btn rounded-[10px] text-[12.5px] font-semibold inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
                  >
                    <i
                      className={`fas ${
                        isDiscoveringToken ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'
                      } text-xs badge-white`}
                    ></i>
                    <span>
                      {isDiscoveringToken ? 'Connecting…' : 'Auto-Discover FB & IG'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Auto-Population Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="apple-subcard p-3.5 rounded-[12px] flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center">
                      <InstagramIcon className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <p className="text-[12.5px] font-semibold text-[var(--apple-text-primary)]">
                        Auto-Populate Instagram
                      </p>
                      <p className="text-[11px] text-[var(--apple-text-secondary)]">
                        Mirror every blog post to IG
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={socialConfig.autoPopulateInstagram}
                    onChange={(e) =>
                      setSocialConfig({
                        ...socialConfig,
                        autoPopulateInstagram: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-[#DD2A7B]"
                  />
                </label>

                <label className="apple-subcard p-3.5 rounded-[12px] flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-[#1877F2] text-white flex items-center justify-center">
                      <FacebookIcon className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <p className="text-[12.5px] font-semibold text-[var(--apple-text-primary)]">
                        Auto-Populate Facebook
                      </p>
                      <p className="text-[11px] text-[var(--apple-text-secondary)]">
                        Mirror every blog post to FB
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={socialConfig.autoPopulateFacebook}
                    onChange={(e) =>
                      setSocialConfig({
                        ...socialConfig,
                        autoPopulateFacebook: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-[#1877F2]"
                  />
                </label>
              </div>

              <div className="apple-subcard p-3.5 rounded-[12px] flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                    Auto-Publish Social When Blog Is Published
                  </p>
                  <p className="text-[11px] text-[var(--apple-text-secondary)]">
                    Automatically dispatch to Meta Graph API / Webhook whenever an article goes live
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={socialConfig.autoPublishOnBlogPublish}
                  onChange={(e) =>
                    setSocialConfig({
                      ...socialConfig,
                      autoPublishOnBlogPublish: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-[#4e45e1]"
                />
              </div>

              {/* Account Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Instagram Handle
                  </label>
                  <input
                    type="text"
                    value={socialConfig.instagramHandle}
                    onChange={(e) =>
                      setSocialConfig({ ...socialConfig, instagramHandle: e.target.value })
                    }
                    placeholder="@devinquire"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Facebook Page Name
                  </label>
                  <input
                    type="text"
                    value={socialConfig.facebookPageName}
                    onChange={(e) =>
                      setSocialConfig({ ...socialConfig, facebookPageName: e.target.value })
                    }
                    placeholder="DevInquire"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              {/* Default Hashtags */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Default Brand Hashtags
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={socialHashtagInput}
                    onChange={(e) => setSocialHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSocialHashtag();
                      }
                    }}
                    placeholder="Add hashtag (e.g., CloudNative)…"
                    className="flex-1 apple-input px-3.5 py-2 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSocialHashtag}
                    className="px-3.5 py-2 apple-secondary-btn rounded-[10px] text-[12px] font-semibold"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {socialConfig.defaultHashtags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#4e45e1]/10 text-[var(--apple-blue)]"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveSocialHashtag(tag)}
                        className="hover:text-[#FF3B30]"
                      >
                        <i className="fas fa-times text-[9px]"></i>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Webhook Automation (Make / Zapier / n8n) */}
              <div className="space-y-1.5 pt-2 border-t border-[var(--apple-border)]">
                <label className="text-[12px] font-semibold text-[var(--apple-text-primary)]">
                  Automation Webhook URL (Make.com / Zapier / n8n — Optional)
                </label>
                <input
                  type="url"
                  value={socialConfig.webhookUrl}
                  onChange={(e) =>
                    setSocialConfig({ ...socialConfig, webhookUrl: e.target.value })
                  }
                  placeholder="https://hook.eu1.make.com/… or https://hooks.zapier.com/…"
                  className="w-full apple-input px-3.5 py-2 text-[13px]"
                />
                <p className="text-[11px] text-[var(--apple-text-tertiary)]">
                  Receives unified JSON payload whenever an Instagram or Facebook post is published.
                </p>
              </div>

              {/* Meta Graph API Direct Publishing Credentials */}
              <div className="space-y-3 pt-2 border-t border-[var(--apple-border)]">
                <p className="text-[12px] font-semibold text-[var(--apple-text-primary)]">
                  Direct Meta Graph API Credentials (Optional)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      Facebook Page ID
                    </label>
                    <input
                      type="text"
                      value={socialConfig.facebookPageId}
                      onChange={(e) =>
                        setSocialConfig({ ...socialConfig, facebookPageId: e.target.value })
                      }
                      placeholder="e.g., 1049281938472"
                      className="w-full apple-input px-3 py-2 text-[12.5px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      Facebook Page Access Token
                    </label>
                    <input
                      type="password"
                      value={socialConfig.facebookAccessToken}
                      onChange={(e) =>
                        setSocialConfig({
                          ...socialConfig,
                          facebookAccessToken: e.target.value,
                        })
                      }
                      placeholder="EAAG…"
                      className="w-full apple-input px-3 py-2 text-[12.5px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      Instagram Business Account ID
                    </label>
                    <input
                      type="text"
                      value={socialConfig.instagramAccountId}
                      onChange={(e) =>
                        setSocialConfig({
                          ...socialConfig,
                          instagramAccountId: e.target.value,
                        })
                      }
                      placeholder="e.g., 17841400000000"
                      className="w-full apple-input px-3 py-2 text-[12.5px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      Instagram Graph Access Token
                    </label>
                    <input
                      type="password"
                      value={socialConfig.instagramAccessToken}
                      onChange={(e) =>
                        setSocialConfig({
                          ...socialConfig,
                          instagramAccessToken: e.target.value,
                        })
                      }
                      placeholder="EAAG…"
                      className="w-full apple-input px-3 py-2 text-[12.5px]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSocialConfigModal(false)}
                  className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSocialConfig}
                  className="flex-1 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold disabled:opacity-50"
                >
                  {isSavingSocialConfig ? 'Saving…' : 'Save Social Automation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Blog Settings & Configuration Modal (Admin) */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                  Editorial Studio &amp; Blog Configuration
                </h3>
                <p className="text-[12px] text-[var(--apple-text-secondary)]">
                  Manage publishing endpoints, default author, and article categories.
                </p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="w-8 h-8 rounded-full apple-subcard text-[var(--apple-text-secondary)] flex items-center justify-center"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Live Website Sync URL
                  </label>
                  <input
                    required
                    type="text"
                    value={blogConfig.siteUrl}
                    onChange={(e) => setBlogConfig({ ...blogConfig, siteUrl: e.target.value })}
                    placeholder="https://devinquire.com"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Default Author Name
                  </label>
                  <input
                    required
                    type="text"
                    value={blogConfig.defaultAuthor}
                    onChange={(e) =>
                      setBlogConfig({ ...blogConfig, defaultAuthor: e.target.value })
                    }
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Default Article Status
                  </label>
                  <select
                    value={blogConfig.defaultStatus}
                    onChange={(e) =>
                      setBlogConfig({
                        ...blogConfig,
                        defaultStatus: e.target.value as 'draft' | 'published',
                      })
                    }
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published Immediately</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    SEO Title Suffix
                  </label>
                  <input
                    type="text"
                    value={blogConfig.seoTitleSuffix}
                    onChange={(e) =>
                      setBlogConfig({ ...blogConfig, seoTitleSuffix: e.target.value })
                    }
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              <div className="apple-subcard p-3.5 rounded-[12px] flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                    Auto-Sync to Main Website on Publish
                  </p>
                  <p className="text-[11px] text-[var(--apple-text-secondary)]">
                    Automatically trigger webhook sync when an article is published
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={blogConfig.autoSyncOnPublish}
                  onChange={(e) =>
                    setBlogConfig({ ...blogConfig, autoSyncOnPublish: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#4e45e1]"
                />
              </div>

              {/* Manage Categories */}
              <div className="space-y-2">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Editorial Categories
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                    placeholder="Add new category (e.g., Case Studies)…"
                    className="flex-1 apple-input px-3.5 py-2 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-4 py-2 apple-secondary-btn rounded-[10px] text-[12px] font-semibold"
                  >
                    Add Category
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {blogConfig.categories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-[#4e45e1]/10 text-[var(--apple-blue)]"
                    >
                      <span>{cat}</span>
                      {blogConfig.categories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat)}
                          className="hover:text-[#FF3B30]"
                          title={`Remove ${cat}`}
                        >
                          <i className="fas fa-times text-[10px]"></i>
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="flex-1 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold disabled:opacity-50"
                >
                  {isSavingConfig ? 'Saving…' : 'Save Blog Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogManagement;
