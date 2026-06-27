import React, { useState, useEffect, useMemo } from 'react';
import { BlogPost } from '../types';
import { generateBlogPostDraft } from '../services/geminiService';
import { api } from '../services/api';

const BlogManagement: React.FC = () => {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [postToSync, setPostToSync] = useState<BlogPost | null>(null);

  const [newPost, setNewPost] = useState<Partial<BlogPost>>({
    title: '',
    excerpt: '',
    content: '',
    category: 'Engineering',
    tags: []
  });

  useEffect(() => {
    fetchBlogs();
    const interval = setInterval(fetchBlogs, 30000); // 30s Real-time Sync
    return () => clearInterval(interval);
  }, []);

  const fetchBlogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.blog.list();
      if (res.status === 'success') {
        const mapped = res.data.map((b: any) => ({
          ...b,
          id: b.id.toString(),
          status: b.status === 'published' ? 'synced' : b.status,
          author: b.author_name || 'System',
          date: b.created_at.split(' ')[0]
        }));
        setBlogs(mapped);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError("Failed to fetch orchestration logs.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = useMemo(() => {
    if (blogs.length === 0) return ['All'];
    const cats = Array.from(new Set(blogs.map(b => b.category)));
    return ['All', ...cats];
  }, [blogs]);

  const filteredBlogs = useMemo(() => {
    if (selectedCategory === 'All') return blogs;
    return blogs.filter(b => b.category === selectedCategory);
  }, [blogs, selectedCategory]);

  const handleSaveDraft = async () => {
    if (!newPost.title) return;
    try {
      const res = await api.blog.create(newPost);
      if (res.status === 'success') {
        setIsEditorOpen(false);
        setNewPost({ title: '', excerpt: '', content: '', category: 'Engineering', tags: [] });
        fetchBlogs();
      }
    } catch (err) {
      console.error("Draft Save error:", err);
    }
  };

  const handleAiDraft = async () => {
    if (!newPost.title) {
      alert("Please enter a working title first.");
      return;
    }
    setIsAiLoading(true);
    try {
      const draft = await generateBlogPostDraft(newPost.title);

      const titleMatch = draft.match(/TITLE:\s*(.*)/i);
      const excerptMatch = draft.match(/EXCERPT:\s*(.*)/i);
      const contentMatch = draft.match(/CONTENT:\s*([\s\S]*)/i);

      setNewPost(prev => ({
        ...prev,
        title: titleMatch ? titleMatch[1].trim() : prev.title,
        excerpt: excerptMatch ? excerptMatch[1].trim() : "Generated draft excerpt...",
        content: contentMatch ? contentMatch[1].trim() : draft
      }));
    } catch (err) {
      console.error("AI Generation error:", err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const syncWithDevInquire = async (id: string) => {
    setPostToSync(null);
    setIsSyncing(id);
    try {
      const res = await api.blog.sync(id);
      if (res.status === 'success') {
        fetchBlogs();
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(null);
    }
  };

  const initiateSync = (blog: BlogPost) => {
    setPostToSync(blog);
  };

  if (isLoading && blogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Indexing Content Archive...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Blog Management</h1>
          <p className="text-slate-400">Manage, draft, and sync your technical articles with devinquire.com</p>
        </div>
        <button
          onClick={() => setIsEditorOpen(true)}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> Create New Post
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-3">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {!isEditorOpen && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border border-indigo-500'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-300'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {isEditorOpen ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/30">
            <h3 className="font-bold flex items-center gap-2">
              <i className="fas fa-edit text-indigo-400"></i> New Article Draft
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleAiDraft}
                disabled={isAiLoading}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-all"
              >
                {isAiLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-magic"></i>}
                AI Write with Gemini
              </button>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-1.5 hover:bg-slate-800 text-slate-400 rounded-lg text-xs font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Article Title</label>
              <input
                value={newPost.title}
                onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                placeholder="e.g. Modern State Management in 2024"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-lg font-semibold focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Category</label>
                <select
                  value={newPost.category}
                  onChange={e => setNewPost({ ...newPost, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                >
                  <option>Engineering</option>
                  <option>Design</option>
                  <option>Tutorial</option>
                  <option>Case Study</option>
                  <option>Backend</option>
                  <option>Infrastructure</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tags (comma separated)</label>
                <input
                  placeholder="react, web3, cloud"
                  onChange={e => setNewPost({ ...newPost, tags: e.target.value.split(',').map(t => t.trim()) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Short Excerpt</label>
              <textarea
                rows={2}
                value={newPost.excerpt}
                onChange={e => setNewPost({ ...newPost, excerpt: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all resize-none"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Content (Markdown Supported)</label>
                <span className="text-[10px] text-slate-600">Autosaved just now</span>
              </div>
              <textarea
                rows={12}
                value={newPost.content}
                onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono focus:border-indigo-500 outline-none transition-all resize-y"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSaveDraft}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold transition-all"
              >
                Save Draft to Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredBlogs.length > 0 ? filteredBlogs.map((blog) => (
            <div key={blog.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all flex flex-col md:flex-row gap-6 items-start md:items-center animate-in slide-in-from-left-4 duration-300">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-0.5 bg-indigo-600/10 text-indigo-400 text-[10px] font-bold uppercase rounded border border-indigo-600/20">
                    {blog.category}
                  </span>
                  <span className="text-xs text-slate-500">• {blog.date}</span>
                </div>
                <h3 className="text-xl font-bold mb-2 truncate">{blog.title}</h3>
                <p className="text-slate-400 text-sm line-clamp-2">{blog.excerpt}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {blog.tags?.map((tag, i) => (
                    <span key={i} className="text-[10px] text-slate-500">#{tag}</span>
                  ))}
                </div>
              </div>

              <div className="w-full md:w-auto flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 mb-2">
                  {blog.status === 'synced' ? (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <i className="fas fa-check-circle"></i> Live on devinquire.com
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                      <i className="fas fa-clock"></i> Pending Sync
                    </span>
                  )}
                </div>

                <div className="flex gap-2 w-full">
                  <button className="flex-1 md:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-all">
                    Edit
                  </button>
                  <button
                    onClick={() => initiateSync(blog)}
                    disabled={blog.status === 'synced' || isSyncing === blog.id}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${blog.status === 'synced'
                      ? 'bg-emerald-600/10 text-emerald-500 border border-emerald-600/20 cursor-default'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                  >
                    {isSyncing === blog.id ? (
                      <i className="fas fa-circle-notch fa-spin"></i>
                    ) : (
                      <i className="fas fa-sync-alt"></i>
                    )}
                    {blog.status === 'synced' ? 'Synced' : 'Sync to Live'}
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-20 text-center">
              <i className="fas fa-folder-open text-4xl text-slate-700 mb-4 block"></i>
              <p className="text-slate-500">No blog posts found in the "{selectedCategory}" category.</p>
              <button onClick={() => setSelectedCategory('All')} className="mt-4 text-indigo-400 text-sm hover:underline">Show all posts</button>
            </div>
          )}
        </div>
      )}

      {/* Sync Confirmation Modal */}
      {postToSync && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6 text-3xl shadow-inner">
                <i className="fas fa-cloud-upload-alt"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Ready to Deploy?</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                You are about to sync <span className="text-indigo-400 font-bold">"{postToSync.title}"</span> to devinquire.com. This action will make the article visible to the public.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => syncWithDevInquire(postToSync.id)}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
                >
                  <i className="fas fa-sync-alt"></i>
                  Confirm & Deploy Now
                </button>
                <button
                  onClick={() => setPostToSync(null)}
                  className="w-full py-4 bg-slate-950 hover:bg-slate-800 text-slate-500 rounded-2xl font-bold text-sm transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="px-8 py-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-center gap-2">
              <i className="fas fa-info-circle text-slate-600 text-[10px]"></i>
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Production sync takes approx. 2 seconds</p>
            </div>
          </div>
        </div>
      )}

      {!isEditorOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-indigo-600/5 border border-indigo-600/10 rounded-2xl p-6 flex items-center justify-between">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-xl">
                <i className="fas fa-cloud-upload-alt text-white"></i>
              </div>
              <div>
                <h4 className="font-bold text-indigo-100">Sync Pipeline Status</h4>
                <p className="text-sm text-indigo-300/60">Connected to local-mysql.devinquire.com</p>
              </div>
            </div>
            <div className="hidden sm:block px-4 py-2 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
              HEALTHY
            </div>
          </div>

          <div className="bg-indigo-600/5 border border-indigo-600/10 rounded-2xl p-6 flex items-center justify-between">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-xl">
                <i className="fas fa-robot text-white"></i>
              </div>
              <div>
                <h4 className="font-bold text-indigo-100">AI Daily Auto-Publishing</h4>
                <p className="text-sm text-indigo-300/60">Scheduled daily at 8:00 PM (Rotational Categories)</p>
              </div>
            </div>
            <div className="hidden sm:block px-4 py-2 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
              ACTIVE
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogManagement;
