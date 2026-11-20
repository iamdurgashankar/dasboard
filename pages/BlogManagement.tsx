import React, { useState, useEffect, useMemo } from 'react';
import { BlogPost } from '../types';
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

const DEFAULT_BLOG_CONFIG: BlogConfig = {
  siteUrl: 'http://localhost:8000',
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

const BlogManagement: React.FC = () => {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Configuration state
  const [blogConfig, setBlogConfig] = useState<BlogConfig>(DEFAULT_BLOG_CONFIG);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // daily.dev Automation Workflow state
  const [showAutomationPanel, setShowAutomationPanel] = useState(false);
  const [isRunningAutomation, setIsRunningAutomation] = useState(false);
  const [isSavingAutomation, setIsSavingAutomation] = useState(false);
  const [automationConfig, setAutomationConfig] = useState<{
    enabled: boolean;
    intervalMinutes: number;
    autoPublish: boolean;
    maxPerRun: number;
    categoryOverride: string;
    lastRunAt: string | null;
    lastImportedCount: number;
    lastSkippedCount: number;
    lastError: string | null;
  }>({
    enabled: false,
    intervalMinutes: 360,
    autoPublish: true,
    maxPerRun: 10,
    categoryOverride: 'Auto',
    lastRunAt: null,
    lastImportedCount: 0,
    lastSkippedCount: 0,
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
    tags: string[];
  }>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category: 'Engineering',
    author_name: 'DevInquire Editorial',
    status: 'draft',
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchBlogs();
    fetchBlogConfig();
    fetchAutomationStatus();
  }, []);

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
            ? `daily.dev auto-sync enabled (every ${automationConfig.intervalMinutes / 60 >= 1 ? `${automationConfig.intervalMinutes / 60}h` : `${automationConfig.intervalMinutes}m`}).`
            : 'daily.dev automation workflow saved.'
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
    setIsRunningAutomation(true);
    setError(null);
    try {
      const res = await api.blog.runAutomationNow({
        maxPerRun: automationConfig.maxPerRun,
        autoPublish: automationConfig.autoPublish,
        categoryOverride: automationConfig.categoryOverride,
      });
      if (res.status === 'success') {
        if (res.data?.automation) {
          setAutomationConfig((prev) => ({ ...prev, ...res.data.automation }));
        }
        showToast(res.message || 'Synced tech news from daily.dev.');
        await fetchBlogs();
      } else {
        setError(res.message || 'Failed to pull tech news from daily.dev.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to pull tech news from daily.dev.');
    } finally {
      setIsRunningAutomation(false);
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

  const openNewComposer = () => {
    setEditingId(null);
    setCurrentBlog({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      category: blogConfig.categories[0] || 'Engineering',
      author_name: blogConfig.defaultAuthor || 'DevInquire Editorial',
      status: blogConfig.defaultStatus || 'draft',
      tags: [],
    });
    setIsPreviewMode(false);
    setIsComposing(true);
  };

  const handleEdit = (post: any) => {
    setEditingId(post.id);
    setCurrentBlog({
      title: post.title || '',
      slug: post.slug || generateSlug(post.title || ''),
      excerpt: post.excerpt || '',
      content: post.content || '',
      category: post.category || blogConfig.categories[0] || 'Engineering',
      author_name: post.author_name || post.author || blogConfig.defaultAuthor,
      status: post.status === 'published' ? 'published' : 'draft',
      tags: Array.isArray(post.tags) ? post.tags : [],
    });
    setIsPreviewMode(false);
    setIsComposing(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Permanently delete this article from Editorial Studio?')) return;
    try {
      const res = await api.blog.delete(id);
      if (res.status === 'success') {
        await fetchBlogs();
        if (readingPost?.id === id) setReadingPost(null);
        showToast('Article deleted.');
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
      showToast('DI AI generated article draft.');
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
    if (!currentBlog.title.trim()) return;
    setIsSavingPost(true);
    const targetStatus = publishImmediately ? 'published' : currentBlog.status;
    const payload = {
      ...currentBlog,
      slug: currentBlog.slug.trim() || generateSlug(currentBlog.title),
      status: targetStatus,
    };

    try {
      let savedId = editingId;
      if (editingId) {
        const res = await api.blog.update({ id: editingId, ...payload });
        if (res.status !== 'success') throw new Error(res.message);
      } else {
        const res = await api.blog.create(payload);
        if (res.status !== 'success') throw new Error(res.message);
        savedId = res.data?.id ? String(res.data.id) : null;
      }

      if (targetStatus === 'published' && savedId && blogConfig.autoSyncOnPublish) {
        await api.blog.sync(savedId);
      }

      await fetchBlogs();
      setIsComposing(false);
      setEditingId(null);
      showToast(
        targetStatus === 'published'
          ? 'Article published and synced to live website.'
          : 'Article saved to Editorial Studio.'
      );
    } catch (err: any) {
      alert(err.message || 'Failed to save article.');
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleSyncToSite = async (id: string) => {
    setIsSyncing(id);
    try {
      const res = await api.blog.sync(id);
      await fetchBlogs();
      showToast(res.message || 'Article published and synced to live website.');
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
        await fetchBlogs();
        showToast('Article moved to Drafts.');
      } catch (err) {
        console.error(err);
      }
    }
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

  const stats = useMemo(() => {
    const published = blogs.filter((b) => b.status === 'published').length;
    const drafts = blogs.filter((b) => b.status !== 'published').length;
    return {
      total: blogs.length,
      published,
      drafts,
      categories: blogConfig.categories.length,
    };
  }, [blogs, blogConfig.categories]);

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
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--apple-blue)]">
              Content Management & Live Publishing
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]">
              {blogConfig.autoSyncOnPublish ? 'Auto-Sync Active' : 'Manual Sync'}
            </span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-[var(--apple-text-primary)] leading-tight">
            Editorial Studio
          </h1>
          <p className="text-[14px] text-[var(--apple-text-secondary)] mt-0.5 max-w-2xl">
            Draft, configure categories & SEO settings, and publish engineering articles to {blogConfig.siteUrl}.
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
            <span>daily.dev Automation</span>
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="h-10 px-4 apple-secondary-btn rounded-[12px] text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap"
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
              <span>New Article</span>
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

      {/* daily.dev Tech News Automation Workflow */}
      {showAutomationPanel && (
        <div className="apple-card p-5 space-y-4 border border-[#4e45e1]/20 animate-in fade-in duration-300">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-[var(--apple-text-primary)]">
                  daily.dev Tech News Automation Workflow
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    automationConfig.enabled
                      ? 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]'
                      : 'bg-[var(--apple-bg-tertiary)] text-[var(--apple-text-secondary)]'
                  }`}
                >
                  {automationConfig.enabled ? 'Scheduled Active' : 'Manual Mode'}
                </span>
              </div>
              <p className="text-[12.5px] text-[var(--apple-text-secondary)] mt-0.5">
                Automatically pull the latest tech news from <strong>daily.dev</strong>, map each story to your blog categories, and publish or stage as drafts (duplicates skipped automatically).
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={isSavingAutomation}
                onClick={handleSaveAutomation}
                className="h-9 px-3.5 apple-secondary-btn rounded-[10px] text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-60"
              >
                <i className={`fas ${isSavingAutomation ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} text-xs`}></i>
                <span>{isSavingAutomation ? 'Saving…' : 'Save Workflow'}</span>
              </button>
              <button
                type="button"
                disabled={isRunningAutomation}
                onClick={handleRunAutomationNow}
                className="h-9 px-4 apple-pill-btn rounded-[10px] text-[12.5px] font-semibold inline-flex items-center gap-2 disabled:opacity-60"
              >
                <i className={`fas ${isRunningAutomation ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-down'} text-xs badge-white`}></i>
                <span>{isRunningAutomation ? 'Pulling from daily.dev…' : 'Pull & Post Now'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
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
                <strong>Last Imported:</strong> {automationConfig.lastImportedCount} new (
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
        <div className="apple-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Total Articles
            </p>
            <p className="text-[22px] font-bold text-[var(--apple-text-primary)] mt-0.5">
              {stats.total}
            </p>
          </div>
          <div className="w-9 h-9 rounded-[10px] bg-[#4e45e1]/10 text-[var(--apple-blue)] flex items-center justify-center">
            <i className="fas fa-newspaper text-sm"></i>
          </div>
        </div>

        <div className="apple-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Published & Live
            </p>
            <p className="text-[22px] font-bold text-[#248A3D] dark:text-[#30D158] mt-0.5">
              {stats.published}
            </p>
          </div>
          <div className="w-9 h-9 rounded-[10px] bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158] flex items-center justify-center">
            <i className="fas fa-globe text-sm"></i>
          </div>
        </div>

        <div className="apple-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Working Drafts
            </p>
            <p className="text-[22px] font-bold text-[#FF9500] mt-0.5">
              {stats.drafts}
            </p>
          </div>
          <div className="w-9 h-9 rounded-[10px] bg-[#FF9500]/12 text-[#FF9500] flex items-center justify-center">
            <i className="fas fa-pen-ruler text-sm"></i>
          </div>
        </div>

        <div className="apple-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Default Author
            </p>
            <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] mt-0.5 truncate">
              {blogConfig.defaultAuthor}
            </p>
            <p className="text-[11px] text-[var(--apple-text-tertiary)]">
              {stats.categories} configured categories
            </p>
          </div>
          <div className="w-9 h-9 rounded-[10px] bg-[#5856D6]/12 text-[#5856D6] flex items-center justify-center">
            <i className="fas fa-feather-pointed text-sm"></i>
          </div>
        </div>
      </div>

      {/* Article Composer or Article Directory */}
      {isComposing ? (
        <div className="apple-card p-6 sm:p-8 space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--apple-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[#4e45e1]/12 text-[var(--apple-blue)] flex items-center justify-center">
                <i className="fas fa-pen-nib"></i>
              </div>
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--apple-text-primary)]">
                  {editingId ? 'Edit Article' : 'Compose New Article'}
                </h2>
                <p className="text-[12px] text-[var(--apple-text-secondary)]">
                  Configure metadata, write in Markdown, or draft with DI AI.
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
                  Preview
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
                  <span>DI AI Draft Assistant</span>
                </div>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Enter a technical topic (e.g., Zero-Downtime Microservice Migrations)…"
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
                    Article Headline *
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

              {/* Category, Author, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    <option value="published">Published (Live on Website)</option>
                  </select>
                </div>
              </div>

              {/* Excerpt & Tags */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Executive Summary / Excerpt
                  </label>
                  <textarea
                    rows={3}
                    value={currentBlog.excerpt}
                    onChange={(e) =>
                      setCurrentBlog((prev) => ({ ...prev, excerpt: e.target.value }))
                    }
                    placeholder="Concise summary for blog cards and SEO meta description…"
                    className="w-full apple-input p-3 text-[13px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Article Tags
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
                      placeholder="Add tag and press Enter…"
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
                  Article Body (Markdown Supported)
                </label>
                <textarea
                  rows={14}
                  value={currentBlog.content}
                  onChange={(e) =>
                    setCurrentBlog((prev) => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="# Introduction&#10;&#10;Write your article content in Markdown…"
                  className="w-full apple-input p-4 text-[13px] font-mono leading-relaxed"
                />
              </div>
            </div>
          ) : (
            <div className="apple-subcard p-6 sm:p-10 rounded-[18px] space-y-6">
              <div className="space-y-3 border-b border-[var(--apple-border)] pb-6">
                <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#4e45e1]/12 text-[var(--apple-blue)]">
                  {currentBlog.category}
                </span>
                <h1 className="text-[28px] font-bold text-[var(--apple-text-primary)]">
                  {currentBlog.title || 'Untitled Article'}
                </h1>
                <p className="text-[13px] text-[var(--apple-text-secondary)]">
                  By {currentBlog.author_name} • /{currentBlog.slug || 'article-slug'}
                </p>
                {currentBlog.excerpt && (
                  <p className="text-[14px] text-[var(--apple-text-secondary)] italic pt-1">
                    {currentBlog.excerpt}
                  </p>
                )}
              </div>
              <div
                className="text-[14px] leading-relaxed text-[var(--apple-text-primary)]"
                dangerouslySetInnerHTML={{ __html: formatMarkdown(currentBlog.content) }}
              />
            </div>
          )}

          {/* Save & Publish Footer */}
          <div className="pt-4 border-t border-[var(--apple-border)] flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              disabled={isSavingPost || !currentBlog.title.trim()}
              onClick={() => handleSave(false)}
              className="px-5 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-semibold disabled:opacity-50"
            >
              {isSavingPost ? 'Saving…' : editingId ? 'Save Changes' : 'Save Draft'}
            </button>
            <button
              type="button"
              disabled={isSavingPost || !currentBlog.title.trim()}
              onClick={() => handleSave(true)}
              className="px-5 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <i className="fas fa-cloud-arrow-up text-xs badge-white"></i>
              <span>{isSavingPost ? 'Publishing…' : 'Publish & Sync Live'}</span>
            </button>
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
                    { key: 'all', label: 'All', count: stats.total },
                    { key: 'published', label: 'Published', count: stats.published },
                    { key: 'draft', label: 'Draft', count: stats.drafts },
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
                placeholder="Search articles, categories, tags…"
                className="w-full apple-input h-10 pl-9 pr-4 text-[13px] rounded-[11px]"
              />
            </div>
          </div>

          {/* Articles Grid */}
          {isLoading && blogs.length === 0 ? (
            <div className="apple-card p-12 text-center text-[13px] text-[var(--apple-text-secondary)]">
              Loading Editorial Studio articles…
            </div>
          ) : filteredBlogs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredBlogs.map((blog) => (
                <div
                  key={blog.id}
                  onClick={() => setReadingPost(blog)}
                  className="apple-card p-6 flex flex-col justify-between cursor-pointer hover:border-[var(--apple-blue)] transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#4e45e1]/10 text-[var(--apple-blue)]">
                        {blog.category || 'Engineering'}
                      </span>
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
                          title="Edit Article"
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
                          ? 'Re-Sync Live'
                          : 'Publish Live'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
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
                  Create your first engineering article or use DI AI to draft and publish directly to your live blog.
                </p>
                <button
                  onClick={openNewComposer}
                  className="px-4 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center gap-2 mt-2"
                >
                  <i className="fas fa-plus text-xs badge-white"></i>
                  <span>Create First Article</span>
                </button>
              </div>
            </div>
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
                  Edit Article
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

      {/* Blog Settings & Configuration Modal (Admin) */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                  Editorial Studio & Blog Configuration
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
