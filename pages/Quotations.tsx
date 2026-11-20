import React, { useState, useMemo, useEffect } from 'react';
import { api } from '../services/api';

interface LineItem {
  id: string;
  title: string;
  description: string;
  period: string;
  amount: number;
}

interface QuotationData {
  id: string;
  slug?: string;
  quotationNo: string;
  date: string;
  validUntil: string;
  title: string;
  subtitle: string;
  currency: 'INR' | 'USD';
  preparedByName: string;
  preparedByAddress: string;
  preparedByContact: string;
  preparedByGstin: string;
  clientName: string;
  clientWebsite: string;
  clientAddress: string;
  salutation: string;
  introText: string;
  items: LineItem[];
  taxPercent: number;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  terms: string[];
  note: string;
  signatoryName: string;
  clientSignatoryLabel: string;
  clientDecision?: 'agreed' | 'rejected' | '';
  clientDecisionAt?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'devinquire_quotations_v1';

const formatToday = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const createDefaultQuotation = (): QuotationData => ({
  id: `qt-${Date.now()}`,
  quotationNo: `DI-${new Date().getFullYear()}-${String(Math.floor(10 + Math.random() * 89))}`,
  date: formatToday(0),
  validUntil: formatToday(14),
  title: 'Quotation',
  subtitle: 'Annual website server / hosting charges',
  currency: 'INR',
  preparedByName: 'DevInquire',
  preparedByAddress: 'Hulimavu, Bangalore',
  preparedByContact: 'contact@devinquire.com · 8763155488',
  preparedByGstin: 'GSTIN, Not applicable',
  clientName: 'Manomantapa',
  clientWebsite: 'manomantapa.com',
  clientAddress:
    'Manomantapa Trust (R), Opposite APMC gate, 5th Cross, VV nagara, Kallahalli, Mandya-571401.',
  salutation: 'Dear Manomantapa Team,',
  introText:
    'Thank you for considering DevInquire. Please find below our quotation for the annual server and website hosting services for manomantapa.com.',
  items: [
    {
      id: 'item-1',
      title: 'Annual website server / hosting charges',
      description:
        'Server hosting for the website, including the agreed annual hosting allocation.',
      period: '1 Year',
      amount: 4500,
    },
  ],
  taxPercent: 0,
  servicePeriodStart: formatToday(2),
  servicePeriodEnd: (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  })(),
  terms: [
    'Payment terms: 100% of the annual service charges shall be payable in advance before the commencement of the service period.',
    'Renewal: Renewal charges for the next term will be communicated before expiry.',
    'Scope: This quotation covers the listed services only. Domain renewal, premium licences, third-party services, development work, maintenance, and additional resources are excluded unless specifically agreed in writing.',
    "Taxes: Applicable taxes will be charged as shown above, subject to the supplier's tax registration and invoicing requirements.",
  ],
  note: 'This is a quotation and not a tax invoice. The final invoice will be issued after confirmation of the service and payment details.',
  signatoryName: 'Durga Shankar Das Mangaraj',
  clientSignatoryLabel: '',
  updatedAt: new Date().toISOString(),
});

interface CatalogEntry {
  id: string;
  group: 'Services' | 'Products';
  category: string;
  title: string;
  description: string;
  period: string;
  defaultAmount: number;
}

const CATALOG_ITEMS: CatalogEntry[] = [
  // Services & Hosting
  {
    id: 'srv-hosting',
    group: 'Services',
    category: 'Hosting & Maintenance',
    title: 'Annual Website Server / Hosting Charges',
    description: 'Managed cloud hosting, SSL certificate, automated backups, and uptime monitoring.',
    period: '1 Year',
    defaultAmount: 4500,
  },
  {
    id: 'srv-migration',
    group: 'Services',
    category: 'Web & Redesign',
    title: 'Website Migration & Redesign',
    description: 'Zero-downtime architecture migration, modern UI redesign, and Core Web Vitals boost.',
    period: '2–3 Weeks',
    defaultAmount: 18000,
  },
  {
    id: 'srv-landing',
    group: 'Services',
    category: 'Web & Conversion',
    title: 'Landing Page Development',
    description: 'High-conversion, ultra-fast launch page tailored for product launches and growth.',
    period: '1–2 Weeks',
    defaultAmount: 12000,
  },
  {
    id: 'srv-maintenance',
    group: 'Services',
    category: 'Hosting & Maintenance',
    title: 'Web Maintenance Plans',
    description: 'Proactive security patching, speed & database tuning, cloud backups, and priority updates.',
    period: '1 Year',
    defaultAmount: 9600,
  },
  {
    id: 'srv-custom-web',
    group: 'Services',
    category: 'Web Engineering',
    title: 'Custom Website Development',
    description: 'Bespoke responsive website with modern frameworks, technical SEO, and CMS integration.',
    period: '3–4 Weeks',
    defaultAmount: 28000,
  },
  {
    id: 'srv-web-app',
    group: 'Services',
    category: 'Full-Stack SaaS',
    title: 'Web Application Development',
    description: 'Full-stack SaaS web application with distributed backend, REST/GraphQL APIs, and RBAC.',
    period: '6–8 Weeks',
    defaultAmount: 55000,
  },
  {
    id: 'srv-mobile-app',
    group: 'Services',
    category: 'Mobile Engineering',
    title: 'Mobile Application Development',
    description: 'iOS & Android application built for fluid touch interactions, push notifications, and store launch.',
    period: '6–8 Weeks',
    defaultAmount: 65000,
  },
  {
    id: 'srv-seo',
    group: 'Services',
    category: 'SEO & Growth',
    title: 'SEO & Growth Engineering',
    description: 'Technical SEO audits, Core Web Vitals optimization, JSON-LD schema, and organic strategy.',
    period: '1 Month',
    defaultAmount: 10000,
  },
  {
    id: 'srv-branding',
    group: 'Services',
    category: 'Design Systems',
    title: 'Brand & Interface Design',
    description: 'Cohesive visual identity system, design token library, iconography, and UI guidelines.',
    period: '2 Weeks',
    defaultAmount: 16000,
  },
  {
    id: 'srv-ecommerce',
    group: 'Services',
    category: 'E-Commerce',
    title: 'E-Commerce Engineering',
    description: 'High-converting storefront with catalog management, payment gateways, and order tracking.',
    period: '4–5 Weeks',
    defaultAmount: 38000,
  },
  {
    id: 'srv-ai-tools',
    group: 'Services',
    category: 'AI & Extensions',
    title: 'AI-Powered Tools',
    description: 'Custom AI assistants, intelligent workflow automation, and LLM API integration.',
    period: '4 Weeks',
    defaultAmount: 45000,
  },
  {
    id: 'srv-cms-ext',
    group: 'Services',
    category: 'AI & Extensions',
    title: 'CMS Extensions',
    description: 'Custom CMS plugins, page builder modules, conversion CTAs, and workflow integrations.',
    period: '2 Weeks',
    defaultAmount: 14000,
  },
  {
    id: 'srv-browser-ext',
    group: 'Services',
    category: 'AI & Extensions',
    title: 'Browser Extensions',
    description: 'Custom Chrome/Edge Manifest V3 productivity extensions and contextual AI tools.',
    period: '2–3 Weeks',
    defaultAmount: 18000,
  },
  {
    id: 'srv-ui-kits',
    group: 'Services',
    category: 'Design Systems',
    title: 'Apple UI Kits',
    description: 'Production-ready React dashboards, component libraries, and liquid-glass UI kits.',
    period: '1 License',
    defaultAmount: 12000,
  },

  // Products
  {
    id: 'prd-cms',
    group: 'Products',
    category: 'Software',
    title: 'DevInquire CMS',
    description: 'Headless content management system with multi-site publishing, API-first workflows, and CDN caching.',
    period: '1 Year License',
    defaultAmount: 15000,
  },
  {
    id: 'prd-analytics',
    group: 'Products',
    category: 'Analytics',
    title: 'Analytics Pro',
    description: 'Real-time web analytics & performance suite with Core Web Vitals tracking and custom funnels.',
    period: '1 Year License',
    defaultAmount: 12000,
  },
  {
    id: 'prd-ecommerce',
    group: 'Products',
    category: 'E-Commerce',
    title: 'E-Commerce Suite',
    description: 'Complete digital storefront platform with inventory sync, multi-currency checkout, and automated invoicing.',
    period: '1 Year License',
    defaultAmount: 24000,
  },
  {
    id: 'prd-chatbot',
    group: 'Products',
    category: 'AI/ML',
    title: 'AI Chatbot Builder',
    description: 'No-code intelligent conversational assistant with RAG knowledge base and lead capture webhooks.',
    period: '1 Year License',
    defaultAmount: 18000,
  },
  {
    id: 'prd-mobile-fw',
    group: 'Products',
    category: 'Mobile',
    title: 'Mobile App Framework',
    description: 'Cross-platform mobile starter with offline sync, biometric auth, and push notification engine.',
    period: '1 License',
    defaultAmount: 22000,
  },
  {
    id: 'prd-security',
    group: 'Products',
    category: 'Security',
    title: 'Security Shield',
    description: 'Enterprise web security suite with WAF rules, DDoS protection, SSL automation, and threat alerts.',
    period: '1 Year License',
    defaultAmount: 14000,
  },
];

const CATALOG_CATEGORIES = [
  'All',
  'Services',
  'Products',
  ...Array.from(new Set(CATALOG_ITEMS.map((c) => c.category))),
];

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(amount: number, currency: 'INR' | 'USD'): string {
  const num = Number(amount) || 0;
  if (currency === 'USD') {
    return `$ ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function buildStandaloneHtml(q: QuotationData, subtotal: number, taxAmount: number, total: number): string {
  const rowsHtml = q.items
    .map(
      (item, idx) => `
      <tr>
        <td>${String(idx + 1).padStart(2, '0')}</td>
        <td><strong>${escapeHtml(item.title)}</strong>
          ${item.description ? `<div class="description">${escapeHtml(item.description)}</div>` : ''}
        </td>
        <td class="num">${escapeHtml(item.period)}</td>
        <td class="num">${escapeHtml(formatMoney(item.amount, q.currency))}</td>
      </tr>`
    )
    .join('');

  const termsHtml = [
    `<li><strong>Service period:</strong> 12 months, from ${escapeHtml(q.servicePeriodStart)} to ${escapeHtml(q.servicePeriodEnd)}.</li>`,
    ...q.terms.map((t) => {
      const colonIdx = t.indexOf(':');
      if (colonIdx > 0 && colonIdx < 32) {
        return `<li><strong>${escapeHtml(t.slice(0, colonIdx + 1))}</strong>${escapeHtml(t.slice(colonIdx + 1))}</li>`;
      }
      return `<li>${escapeHtml(t)}</li>`;
    }),
  ].join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(q.quotationNo)} | ${escapeHtml(q.clientName)} — DevInquire</title>
<style>
  :root { --ink:#172033; --muted:#667085; --line:#e5e9f0; --accent:#3157d5; --soft:#f4f6fb; }
  * { box-sizing:border-box; }
  body { margin:0; padding:32px; background:#eef1f6; color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",Inter,"Segoe UI",sans-serif; font-size:14px; line-height:1.55; -webkit-font-smoothing:antialiased; }
  .sheet { max-width:850px; margin:0 auto; background:#fff; padding:54px 60px; box-shadow:0 12px 40px rgba(20,30,55,.10); }
  .top { display:flex; justify-content:space-between; gap:24px; align-items:center; border-bottom:1px solid var(--line); padding-bottom:26px; }
  .brand-lockup { display:flex; align-items:center; gap:12px; color:var(--ink); }
  .brand-mark { position:relative; isolation:isolate; width:42px; height:42px; flex:0 0 42px; border-radius:13px; background:linear-gradient(155deg,#7770ff 0%,#5b53ed 48%,#493fda 100%); display:flex; align-items:center; justify-content:center; color:#fff; font-size:13px; font-weight:750; letter-spacing:-.55px; line-height:1; box-shadow:inset 0 1px 0 rgba(255,255,255,.38),0 5px 12px rgba(78,69,225,.22); }
  .brand-mark .brace { color:rgba(255,255,255,.78); font-size:12px; font-weight:600; line-height:1; }
  .brand-copy { display:flex; flex-direction:column; justify-content:center; gap:5px; }
  .brand-name { font-size:20px; font-weight:650; letter-spacing:-.75px; line-height:1; white-space:nowrap; color:#171923; }
  .tagline { color:#778096; font-size:9px; font-weight:600; letter-spacing:1.05px; text-transform:uppercase; margin:0; line-height:1.2; white-space:nowrap; }
  h1 { margin:30px 0 4px; font-size:30px; font-weight:650; letter-spacing:-.9px; line-height:1.15; }
  .sub { color:var(--muted); margin:0; }
  .meta { text-align:right; color:var(--muted); font-size:12px; line-height:1.7; }
  .meta strong { color:var(--ink); font-weight:600; }
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:30px; margin:34px 0; }
  .label { color:var(--muted); font-size:11px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; margin-bottom:8px; }
  .party { padding:18px; background:var(--soft); border-radius:8px; min-height:112px; }
  .party strong { font-size:16px; }
  table { width:100%; border-collapse:collapse; margin:22px 0; }
  th { text-align:left; background:var(--ink); color:#fff; padding:13px 14px; font-size:12px; text-transform:uppercase; letter-spacing:.6px; }
  td { padding:16px 14px; border-bottom:1px solid var(--line); vertical-align:top; }
  .num { text-align:right; white-space:nowrap; }
  .description { color:var(--muted); font-size:13px; margin-top:4px; }
  .totals { width:min(340px,100%); margin:18px 0 0 auto; }
  .totals div { display:flex; justify-content:space-between; padding:7px 0; color:var(--muted); }
  .totals .grand { border-top:2px solid var(--ink); margin-top:6px; padding-top:13px; color:var(--ink); font-weight:800; font-size:18px; }
  h2 { font-size:15px; margin:30px 0 8px; }
  ul { margin:8px 0; padding-left:20px; color:var(--muted); }
  .note { background:var(--soft); border-left:3px solid var(--accent); padding:14px 16px; color:var(--muted); font-size:13px; margin-top:24px; }
  .sign { display:grid; grid-template-columns:1fr 1fr; gap:50px; margin-top:55px; }
  .sign div { border-top:1px solid #aeb6c5; padding-top:9px; color:var(--muted); font-size:12px; }
  footer { border-top:1px solid var(--line); margin-top:45px; padding-top:16px; color:var(--muted); font-size:11px; text-align:center; }
  @media print {
    body { padding:0; background:#fff; }
    .sheet { box-shadow:none; max-width:none; padding:22mm 20mm; }
    @page { size:A4; margin:0; }
  }
</style>
</head>
<body>
<main class="sheet">
  <header class="top">
    <div class="brand-lockup">
      <div class="brand-mark"><span class="brace">{</span><span>DI</span><span class="brace">}</span></div>
      <div class="brand-copy">
        <div class="brand-name">DevInquire</div>
        <div class="tagline">Digital solutions &amp; technology services</div>
      </div>
    </div>
    <div class="meta">
      <div><strong>Quotation No:</strong> ${escapeHtml(q.quotationNo)}</div>
      <div><strong>Date:</strong> ${escapeHtml(q.date)}</div>
      <div><strong>Valid Until:</strong> ${escapeHtml(q.validUntil)}</div>
    </div>
  </header>

  <h1>${escapeHtml(q.title)}</h1>
  <p class="sub">${escapeHtml(q.subtitle)}</p>

  <section class="parties">
    <div>
      <div class="label">Prepared by</div>
      <div class="party">
        <strong>${escapeHtml(q.preparedByName)}</strong><br>
        ${escapeHtml(q.preparedByAddress)}<br>
        ${escapeHtml(q.preparedByContact)}<br>
        ${escapeHtml(q.preparedByGstin)}
      </div>
    </div>
    <div>
      <div class="label">Quotation for</div>
      <div class="party">
        <strong>${escapeHtml(q.clientName)}</strong><br>
        ${q.clientWebsite ? `Website: ${escapeHtml(q.clientWebsite)}<br>` : ''}
        ${escapeHtml(q.clientAddress)}
      </div>
    </div>
  </section>

  <p>${escapeHtml(q.salutation)}</p>
  <p>${escapeHtml(q.introText)}</p>

  <table>
    <thead><tr><th style="width:7%">#</th><th>Service description</th><th class="num">Period</th><th class="num">Amount (${escapeHtml(q.currency)})</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><strong>${escapeHtml(formatMoney(subtotal, q.currency))}</strong></div>
    <div><span>GST / applicable taxes (${q.taxPercent}%)</span><strong>${escapeHtml(formatMoney(taxAmount, q.currency))}</strong></div>
    <div class="grand"><span>Total payable</span><span>${escapeHtml(formatMoney(total, q.currency))}</span></div>
  </div>

  <h2>Service period and terms</h2>
  <ul>
    ${termsHtml}
  </ul>

  <div class="note"><strong>Note:</strong> ${escapeHtml(q.note)}</div>

  <div class="sign">
    <div>For ${escapeHtml(q.preparedByName)}<br><br><strong>${escapeHtml(q.signatoryName)}</strong></div>
    <div>
      Accepted by ${escapeHtml(q.clientName || 'Client')}
      ${
        q.clientDecision
          ? `<div style="margin-top:8px;display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;${
              q.clientDecision === 'agreed'
                ? 'background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;'
                : 'background:#fff1f2;color:#be123c;border:1px solid #fecdd3;'
            }">${q.clientDecision === 'agreed' ? 'Agreed' : 'Rejected'}</div>`
          : '<br><br>'
      }
    </div>
  </div>

  <footer>Thank you for choosing ${escapeHtml(q.preparedByName)}.</footer>
</main>
</body>
</html>`;
}

const Quotations: React.FC = () => {
  const [quotation, setQuotation] = useState<QuotationData>(createDefaultQuotation);
  const [savedList, setSavedList] = useState<QuotationData[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState<string | null>(null);
  const [catalogGroup, setCatalogGroup] = useState<'All' | 'Services' | 'Products'>('All');
  const [catalogCategory, setCatalogCategory] = useState<string>('All');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const toSlug = (val: string) =>
    String(val || 'client')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'client';

  const getPublicQuotationUrl = (slug: string) => {
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    return isLocal
      ? `http://localhost:3001/quotation/${slug}`
      : `https://devinquire.com/quotation/${slug}`;
  };

  const refreshSavedQuotations = async () => {
    try {
      const res: any = await api.quotations.list();
      if (res?.status === 'success' && Array.isArray(res.data)) {
        setSavedList(res.data);
        setQuotation((current) => {
          const match = res.data.find(
            (item: QuotationData) =>
              (current.slug && item.slug === current.slug) || item.id === current.id
          );
          if (
            match &&
            (match.clientDecision !== current.clientDecision ||
              match.clientDecisionAt !== current.clientDecisionAt)
          ) {
            return {
              ...current,
              clientDecision: match.clientDecision,
              clientDecisionAt: match.clientDecisionAt,
              updatedAt: match.updatedAt || current.updatedAt,
            };
          }
          return current;
        });
      }
    } catch {
      // ignore background refresh error
    }
  };

  useEffect(() => {
    refreshSavedQuotations();
    const onFocus = () => refreshSavedQuotations();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshSavedQuotations();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedList));
    } catch {
      // ignore storage errors
    }
  }, [savedList]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const subtotal = useMemo(
    () => quotation.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [quotation.items]
  );
  const taxAmount = useMemo(
    () => Math.round((subtotal * (Number(quotation.taxPercent) || 0)) / 100),
    [subtotal, quotation.taxPercent]
  );
  const totalPayable = subtotal + taxAmount;

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setQuotation((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  };

  const addItem = () => {
    setQuotation((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `item-${Date.now()}`,
          title: 'Additional Engineering Service',
          description: 'Scope details and deliverables.',
          period: '1 Month',
          amount: 5000,
        },
      ],
    }));
  };

  const removeItem = (id: string) => {
    if (quotation.items.length <= 1) return;
    setQuotation((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== id),
    }));
  };

  const availableCategories = useMemo(() => {
    const base =
      catalogGroup === 'All'
        ? CATALOG_ITEMS
        : CATALOG_ITEMS.filter((item) => item.group === catalogGroup);
    return ['All', ...Array.from(new Set(base.map((item) => item.category)))];
  }, [catalogGroup]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return CATALOG_ITEMS.filter((item) => {
      const matchesGroup = catalogGroup === 'All' || item.group === catalogGroup;
      const matchesCat = catalogCategory === 'All' || item.category === catalogCategory;
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return matchesGroup && matchesCat && matchesSearch;
    });
  }, [catalogGroup, catalogCategory, catalogSearch]);

  const handleAddCatalogItem = (entry: CatalogEntry, replaceExisting = false) => {
    const newItem: LineItem = {
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: entry.title,
      description: entry.description,
      period: entry.period,
      amount: entry.defaultAmount,
    };
    setQuotation((prev) => ({
      ...prev,
      subtitle: replaceExisting ? entry.title : prev.subtitle,
      introText: replaceExisting
        ? `Thank you for considering DevInquire. Please find below our quotation for ${entry.title}${prev.clientWebsite ? ` for ${prev.clientWebsite}` : ''}.`
        : prev.introText,
      items: replaceExisting ? [newItem] : [...prev.items, newItem],
    }));
    showToast(
      replaceExisting
        ? `Loaded "${entry.title}" quotation.`
        : `Added "${entry.title}" to line items.`
    );
  };

  const handleSaveQuotation = async () => {
    const resolvedSlug = toSlug(quotation.slug || quotation.clientName);
    const updated: QuotationData = {
      ...quotation,
      slug: resolvedSlug,
      updatedAt: new Date().toISOString(),
    };
    setIsPublishing(true);
    try {
      const res = await api.quotations.save(updated);
      const savedQuote = res?.data?.quotation || updated;
      const finalSlug = res?.data?.slug || resolvedSlug;
      setQuotation(savedQuote);
      setSavedList((prev) => {
        const exists = prev.some((q) => q.slug === finalSlug || q.id === savedQuote.id);
        if (exists) {
          return prev.map((q) =>
            q.slug === finalSlug || q.id === savedQuote.id ? savedQuote : q
          );
        }
        return [savedQuote, ...prev];
      });
      const shareUrl = getPublicQuotationUrl(finalSlug);
      setPublishedUrl(shareUrl);
      showToast(`Published to devinquire.com/quotation/${finalSlug}`);
    } catch {
      setQuotation(updated);
      setSavedList((prev) => [updated, ...prev.filter((q) => q.id !== updated.id)]);
      showToast(`Saved locally (${updated.quotationNo}).`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleNewQuotation = () => {
    setQuotation(createDefaultQuotation());
    setPublishedUrl(null);
    showToast('Started a fresh quotation.');
  };

  const handleDeleteSaved = async (id: string, slug?: string) => {
    setSavedList((prev) => prev.filter((q) => q.id !== id));
    await api.quotations.delete({ id, slug }).catch(() => {});
    showToast('Removed saved quotation.');
  };

  const handlePrintPdf = () => {
    const html = buildStandaloneHtml(quotation, subtotal, taxAmount, totalPayable);
    const win = window.open('', '_blank', 'width=980,height=900');
    if (!win) {
      showToast('Please allow popups to print or save as PDF.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 250);
  };

  const handleDownloadHtml = () => {
    const html = buildStandaloneHtml(quotation, subtotal, taxAmount, totalPayable);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quotation.quotationNo.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}-${(quotation.clientName || 'client').toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded standalone quotation HTML.');
  };

  return (
    <div className="space-y-6 pb-10">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-[14px] apple-card border border-[#28CD41]/30 shadow-xl flex items-center gap-2.5 text-[13px] font-semibold text-[var(--apple-text-primary)]">
          <i className="fas fa-circle-check text-[#28CD41]"></i>
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-blue)]">
            Proposal &amp; Billing Studio
          </span>
          <h1 className="text-[28px] font-bold tracking-[-0.025em] text-[var(--apple-text-primary)] mt-1">
            Quotation Generator
          </h1>
          <p className="text-[14px] text-[var(--apple-text-secondary)] mt-0.5">
            Configure client details, line items, taxes, and terms to generate print-ready A4 DevInquire quotations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleNewQuotation}
            className="h-10 px-4 apple-secondary-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center gap-2"
          >
            <i className="fas fa-file-circle-plus text-xs"></i>
            <span>New</span>
          </button>
          <button
            type="button"
            onClick={handleSaveQuotation}
            disabled={isPublishing}
            className="h-10 px-4 apple-pill-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            <i className={`fas ${isPublishing ? 'fa-circle-notch fa-spin' : 'fa-cloud-arrow-up'} text-xs badge-white`}></i>
            <span>{isPublishing ? 'Publishing…' : 'Publish & Get Link'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="h-10 px-4 apple-secondary-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center gap-2"
          >
            <i className="fas fa-code text-xs"></i>
            <span>Export HTML</span>
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="h-10 px-4 apple-secondary-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center gap-2"
          >
            <i className="fas fa-print text-xs"></i>
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Shareable Client Link Banner */}
      {publishedUrl && (
        <div className="apple-card p-4 border border-[#28CD41]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-[#28CD41]/15 text-[#248A3D] dark:text-[#30D158] flex items-center justify-center shrink-0">
              <i className="fas fa-link text-xs"></i>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#248A3D] dark:text-[#30D158]">
                Live Client Quotation Link Ready
              </p>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-mono font-semibold text-[var(--apple-blue)] hover:underline truncate block"
              >
                {publishedUrl}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(publishedUrl);
                showToast('Copied client quotation link!');
              }}
              className="px-3.5 py-2 rounded-[10px] apple-secondary-btn text-[12px] font-semibold inline-flex items-center gap-1.5"
            >
              <i className="fas fa-copy text-xs"></i>
              <span>Copy Link</span>
            </button>
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-[10px] apple-pill-btn text-[12px] font-semibold inline-flex items-center gap-1.5"
            >
              <span className="badge-white">Open Page</span>
              <i className="fas fa-arrow-up-right-from-square text-[11px] badge-white"></i>
            </a>
          </div>
        </div>
      )}

      {/* Saved Quotations Strip */}
      {savedList.length > 0 && (
        <div className="apple-card p-4 flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)] mr-1">
            Saved ({savedList.length}):
          </span>
          {savedList.map((saved) => {
            const isCurrent = saved.id === quotation.id;
            return (
              <div
                key={saved.id}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                  isCurrent
                    ? 'bg-[#4e45e1]/12 border-[#4e45e1]/30 text-[var(--apple-blue)]'
                    : 'apple-subcard border-[var(--apple-border)] text-[var(--apple-text-primary)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setQuotation(saved);
                    if (saved.slug) setPublishedUrl(getPublicQuotationUrl(saved.slug));
                    refreshSavedQuotations();
                  }}
                  className="hover:underline inline-flex items-center gap-1.5"
                >
                  <span>{saved.quotationNo} · {saved.clientName || 'Client'}</span>
                  {saved.clientDecision === 'agreed' && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                      Agreed
                    </span>
                  )}
                  {saved.clientDecision === 'rejected' && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/15 text-rose-600 border border-rose-500/30">
                      Rejected
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSaved(saved.id, saved.slug)}
                  title="Delete saved quotation"
                  className="text-[var(--apple-text-tertiary)] hover:text-[#FF3B30]"
                >
                  <i className="fas fa-xmark text-[11px]"></i>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Split Editor + Live A4 Sheet Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Configuration Form */}
        <div className="xl:col-span-5 space-y-5">
          {/* Services & Products Catalog */}
          <div className="apple-card p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[14px] font-semibold text-[var(--apple-text-primary)]">
                  Services &amp; Products Catalog
                </h2>
                <p className="text-[11px] text-[var(--apple-text-tertiary)]">
                  Search or filter to add items into your quotation
                </p>
              </div>
              <div className="inline-flex items-center p-0.5 rounded-[10px] bg-black/[0.04] dark:bg-white/[0.06] border border-[var(--apple-border)] shrink-0">
                {(['All', 'Services', 'Products'] as const).map((grp) => {
                  const active = catalogGroup === grp;
                  return (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => {
                        setCatalogGroup(grp);
                        setCatalogCategory('All');
                      }}
                      className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold transition-all ${
                        active
                          ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
                          : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                      }`}
                    >
                      {grp}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--apple-text-tertiary)] text-[11px] pointer-events-none"></i>
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Search services or products…"
                  className="apple-input w-full h-9 pl-8 pr-3 text-[12px] rounded-[10px]"
                />
              </div>
              <select
                value={catalogCategory}
                onChange={(e) => setCatalogCategory(e.target.value)}
                aria-label="Filter catalog by category"
                className="apple-input w-full h-9 px-3 text-[12px] font-medium rounded-[10px]"
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            {filteredCatalog.length > 0 ? (
              <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredCatalog.map((entry) => {
                  const isAdded = quotation.items.some(
                    (it) => it.title.trim().toLowerCase() === entry.title.trim().toLowerCase()
                  );
                  return (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-[12px] border flex items-center justify-between gap-3 transition-all ${
                        isAdded
                          ? 'bg-[#4e45e1]/[0.06] border-[#4e45e1]/30'
                          : 'apple-subcard border-[var(--apple-border)]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[12.5px] font-semibold text-[var(--apple-text-primary)] truncate">
                            {entry.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--apple-text-tertiary)]">
                          <span>{entry.category}</span>
                          <span>·</span>
                          <span>{entry.period}</span>
                          <span>·</span>
                          <span className="font-mono font-semibold text-[var(--apple-text-secondary)]">
                            {formatMoney(entry.defaultAmount, quotation.currency)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAddCatalogItem(entry, false)}
                          className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-all ${
                            isAdded
                              ? 'bg-[#28CD41]/15 text-[#248A3D] dark:text-[#30D158] hover:bg-[#28CD41]/25'
                              : 'bg-[#4e45e1] text-white badge-white hover:opacity-90'
                          }`}
                        >
                          {isAdded ? '✓ Added (+1)' : '+ Add'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddCatalogItem(entry, true)}
                          title="Start quote with only this item"
                          className="w-7 h-7 rounded-[8px] apple-secondary-btn text-[11px] flex items-center justify-center"
                        >
                          <i className="fas fa-arrow-right-to-bracket text-[10px]"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="apple-subcard p-5 rounded-[12px] text-center space-y-2">
                <p className="text-[12px] text-[var(--apple-text-secondary)]">
                  No services or products match your filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogGroup('All');
                    setCatalogCategory('All');
                    setCatalogSearch('');
                  }}
                  className="text-[12px] font-semibold text-[var(--apple-blue)] hover:underline"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>

          {/* Metadata & Currency */}
          <div className="apple-card p-5 space-y-4">
            <h2 className="text-[14px] font-semibold text-[var(--apple-text-primary)]">
              Document Metadata
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                  Quotation No
                </label>
                <input
                  type="text"
                  value={quotation.quotationNo}
                  onChange={(e) => setQuotation({ ...quotation, quotationNo: e.target.value })}
                  className="apple-input w-full px-3 py-2 text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                  Currency
                </label>
                <select
                  value={quotation.currency}
                  onChange={(e) =>
                    setQuotation({ ...quotation, currency: e.target.value as 'INR' | 'USD' })
                  }
                  className="apple-input w-full px-3 py-2 text-[13px]"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                  Issue Date
                </label>
                <input
                  type="text"
                  value={quotation.date}
                  onChange={(e) => setQuotation({ ...quotation, date: e.target.value })}
                  className="apple-input w-full px-3 py-2 text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                  Valid Until
                </label>
                <input
                  type="text"
                  value={quotation.validUntil}
                  onChange={(e) => setQuotation({ ...quotation, validUntil: e.target.value })}
                  className="apple-input w-full px-3 py-2 text-[13px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                Quotation Subtitle
              </label>
              <input
                type="text"
                value={quotation.subtitle}
                onChange={(e) => setQuotation({ ...quotation, subtitle: e.target.value })}
                className="apple-input w-full px-3 py-2 text-[13px]"
              />
            </div>
          </div>

          {/* Client Details */}
          <div className="apple-card p-5 space-y-3">
            <h2 className="text-[14px] font-semibold text-[var(--apple-text-primary)]">
              Client Details (Quotation For)
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                  Client / Organization
                </label>
                <input
                  type="text"
                  value={quotation.clientName}
                  onChange={(e) =>
                    setQuotation({
                      ...quotation,
                      clientName: e.target.value,
                      salutation: `Dear ${e.target.value || 'Client'} Team,`,
                    })
                  }
                  className="apple-input w-full px-3 py-2 text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                  Website / Domain
                </label>
                <input
                  type="text"
                  value={quotation.clientWebsite}
                  onChange={(e) => setQuotation({ ...quotation, clientWebsite: e.target.value })}
                  className="apple-input w-full px-3 py-2 text-[13px]"
                  placeholder="example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                Client Address
              </label>
              <textarea
                rows={2}
                value={quotation.clientAddress}
                onChange={(e) => setQuotation({ ...quotation, clientAddress: e.target.value })}
                className="apple-input w-full px-3 py-2 text-[13px] resize-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                Opening Paragraph
              </label>
              <textarea
                rows={2}
                value={quotation.introText}
                onChange={(e) => setQuotation({ ...quotation, introText: e.target.value })}
                className="apple-input w-full px-3 py-2 text-[13px] resize-none"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="apple-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[var(--apple-text-primary)]">
                Services &amp; Pricing
              </h2>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1 rounded-full bg-[#4e45e1]/12 text-[var(--apple-blue)] text-[12px] font-semibold hover:bg-[#4e45e1]/20"
              >
                + Add Line Item
              </button>
            </div>

            <div className="space-y-3">
              {quotation.items.map((item, idx) => (
                <div key={item.id} className="apple-subcard p-3.5 rounded-[12px] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--apple-blue)]">
                      ITEM #{String(idx + 1).padStart(2, '0')}
                    </span>
                    {quotation.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-[11px] text-[#FF3B30] hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItem(item.id, { title: e.target.value })}
                    placeholder="Service title"
                    className="apple-input w-full px-3 py-1.5 text-[13px]"
                  />
                  <textarea
                    rows={2}
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    placeholder="Service description"
                    className="apple-input w-full px-3 py-1.5 text-[12px] resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-medium text-[var(--apple-text-tertiary)] mb-1">
                        Period / Timeline
                      </label>
                      <input
                        type="text"
                        value={item.period}
                        onChange={(e) => updateItem(item.id, { period: e.target.value })}
                        className="apple-input w-full px-3 py-1.5 text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[var(--apple-text-tertiary)] mb-1">
                        Amount ({quotation.currency})
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={item.amount}
                        onChange={(e) =>
                          updateItem(item.id, { amount: parseFloat(e.target.value) || 0 })
                        }
                        className="apple-input w-full px-3 py-1.5 text-[12px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--apple-border)]">
              <div>
                <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                  GST / Tax (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={quotation.taxPercent}
                  onChange={(e) =>
                    setQuotation({ ...quotation, taxPercent: parseFloat(e.target.value) || 0 })
                  }
                  className="apple-input w-full px-3 py-1.5 text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                  Period Start
                </label>
                <input
                  type="text"
                  value={quotation.servicePeriodStart}
                  onChange={(e) =>
                    setQuotation({ ...quotation, servicePeriodStart: e.target.value })
                  }
                  className="apple-input w-full px-3 py-1.5 text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                  Period End
                </label>
                <input
                  type="text"
                  value={quotation.servicePeriodEnd}
                  onChange={(e) =>
                    setQuotation({ ...quotation, servicePeriodEnd: e.target.value })
                  }
                  className="apple-input w-full px-3 py-1.5 text-[13px]"
                />
              </div>
            </div>
          </div>

          {/* Prepared By & Terms */}
          <div className="apple-card p-5 space-y-3">
            <h2 className="text-[14px] font-semibold text-[var(--apple-text-primary)]">
              Supplier &amp; Signatory
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={quotation.preparedByAddress}
                  onChange={(e) =>
                    setQuotation({ ...quotation, preparedByAddress: e.target.value })
                  }
                  className="apple-input w-full px-3 py-1.5 text-[12px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                  Signatory
                </label>
                <input
                  type="text"
                  value={quotation.signatoryName}
                  onChange={(e) => setQuotation({ ...quotation, signatoryName: e.target.value })}
                  className="apple-input w-full px-3 py-1.5 text-[12px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                GSTIN / Tax Status
              </label>
              <input
                type="text"
                value={quotation.preparedByGstin}
                onChange={(e) => setQuotation({ ...quotation, preparedByGstin: e.target.value })}
                className="apple-input w-full px-3 py-1.5 text-[12px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
                Footer Note
              </label>
              <textarea
                rows={2}
                value={quotation.note}
                onChange={(e) => setQuotation({ ...quotation, note: e.target.value })}
                className="apple-input w-full px-3 py-1.5 text-[12px] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right: Live A4 Quotation Sheet Preview (matching manomantapa_server.html) */}
        <div className="xl:col-span-7">
          <div className="rounded-[18px] bg-[#eef1f6] p-4 sm:p-6 overflow-x-auto border border-[var(--apple-border)]">
            <div
              className="mx-auto bg-white text-[#172033] shadow-[0_12px_40px_rgba(20,30,55,0.10)]"
              style={{
                maxWidth: '850px',
                padding: '44px 48px',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, "Segoe UI", sans-serif',
                fontSize: '14px',
                lineHeight: 1.55,
              }}
            >
              {/* Top Header */}
              <header className="flex flex-col sm:flex-row justify-between gap-6 items-start sm:items-center border-b border-[#e5e9f0] pb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                    style={{
                      background: 'linear-gradient(155deg,#7770ff 0%,#5b53ed 48%,#493fda 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.38),0 5px 12px rgba(78,69,225,.22)',
                    }}
                  >
                    <span className="text-white/75 text-[12px] font-semibold">{'{'}</span>
                    <span>DI</span>
                    <span className="text-white/75 text-[12px] font-semibold">{'}'}</span>
                  </div>
                  <div className="flex flex-col justify-center gap-1">
                    <div className="text-[20px] font-semibold tracking-[-0.75px] leading-none text-[#171923]">
                      {quotation.preparedByName}
                    </div>
                    <div className="text-[#778096] text-[9px] font-semibold tracking-[1.05px] uppercase leading-tight">
                      Digital solutions &amp; technology services
                    </div>
                  </div>
                </div>

                <div className="sm:text-right text-[#667085] text-[12px] leading-[1.7]">
                  <div>
                    <strong className="text-[#172033] font-semibold">Quotation No:</strong>{' '}
                    <span>{quotation.quotationNo}</span>
                  </div>
                  <div>
                    <strong className="text-[#172033] font-semibold">Date:</strong>{' '}
                    <span>{quotation.date}</span>
                  </div>
                  <div>
                    <strong className="text-[#172033] font-semibold">Valid Until:</strong>{' '}
                    <span>{quotation.validUntil}</span>
                  </div>
                </div>
              </header>

              {/* Title */}
              <h1 className="mt-7 mb-1 text-[30px] font-semibold tracking-[-0.9px] leading-[1.15] text-[#172033]">
                {quotation.title}
              </h1>
              <p className="text-[#667085] m-0">{quotation.subtitle}</p>

              {/* Parties */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-7 my-8">
                <div>
                  <div className="text-[#667085] text-[11px] font-bold tracking-[1.2px] uppercase mb-2">
                    Prepared by
                  </div>
                  <div className="p-[18px] bg-[#f4f6fb] rounded-[8px] min-h-[112px] text-[13.5px]">
                    <strong className="text-[16px] text-[#172033]">{quotation.preparedByName}</strong>
                    <br />
                    {quotation.preparedByAddress}
                    <br />
                    {quotation.preparedByContact}
                    <br />
                    {quotation.preparedByGstin}
                  </div>
                </div>
                <div>
                  <div className="text-[#667085] text-[11px] font-bold tracking-[1.2px] uppercase mb-2">
                    Quotation for
                  </div>
                  <div className="p-[18px] bg-[#f4f6fb] rounded-[8px] min-h-[112px] text-[13.5px]">
                    <strong className="text-[16px] text-[#172033]">
                      {quotation.clientName || 'Client Name'}
                    </strong>
                    <br />
                    {quotation.clientWebsite && (
                      <>
                        Website: {quotation.clientWebsite}
                        <br />
                      </>
                    )}
                    {quotation.clientAddress}
                  </div>
                </div>
              </section>

              <p className="mb-2">{quotation.salutation}</p>
              <p className="mb-5 text-[#172033]">{quotation.introText}</p>

              {/* Line Items Table */}
              <table className="w-full border-collapse my-5">
                <thead>
                  <tr>
                    <th className="text-left bg-[#172033] text-white px-3.5 py-3 text-[12px] uppercase tracking-[0.6px] w-[7%]">
                      #
                    </th>
                    <th className="text-left bg-[#172033] text-white px-3.5 py-3 text-[12px] uppercase tracking-[0.6px]">
                      Service description
                    </th>
                    <th className="text-right bg-[#172033] text-white px-3.5 py-3 text-[12px] uppercase tracking-[0.6px] whitespace-nowrap">
                      Period
                    </th>
                    <th className="text-right bg-[#172033] text-white px-3.5 py-3 text-[12px] uppercase tracking-[0.6px] whitespace-nowrap">
                      Amount ({quotation.currency})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-3.5 py-4 border-b border-[#e5e9f0] align-top">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="px-3.5 py-4 border-b border-[#e5e9f0] align-top">
                        <strong className="text-[#172033]">{item.title}</strong>
                        {item.description && (
                          <div className="text-[#667085] text-[13px] mt-1">{item.description}</div>
                        )}
                      </td>
                      <td className="px-3.5 py-4 border-b border-[#e5e9f0] align-top text-right whitespace-nowrap">
                        {item.period}
                      </td>
                      <td className="px-3.5 py-4 border-b border-[#e5e9f0] align-top text-right whitespace-nowrap font-medium">
                        {formatMoney(item.amount, quotation.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="w-full max-w-[340px] ml-auto mt-4">
                <div className="flex justify-between py-1.5 text-[#667085]">
                  <span>Subtotal</span>
                  <strong className="text-[#172033]">
                    {formatMoney(subtotal, quotation.currency)}
                  </strong>
                </div>
                <div className="flex justify-between py-1.5 text-[#667085]">
                  <span>GST / applicable taxes ({quotation.taxPercent}%)</span>
                  <strong className="text-[#172033]">
                    {formatMoney(taxAmount, quotation.currency)}
                  </strong>
                </div>
                <div className="flex justify-between border-t-2 border-[#172033] mt-1.5 pt-3 text-[#172033] font-extrabold text-[18px]">
                  <span>Total payable</span>
                  <span>{formatMoney(totalPayable, quotation.currency)}</span>
                </div>
              </div>

              {/* Terms */}
              <h2 className="text-[15px] font-bold text-[#172033] mt-7 mb-2">
                Service period and terms
              </h2>
              <ul className="my-2 pl-5 list-disc text-[#667085] space-y-1">
                <li>
                  <strong className="text-[#172033]">Service period:</strong> 12 months, from{' '}
                  {quotation.servicePeriodStart} to {quotation.servicePeriodEnd}.
                </li>
                {quotation.terms.map((term, idx) => {
                  const colonIdx = term.indexOf(':');
                  if (colonIdx > 0 && colonIdx < 32) {
                    return (
                      <li key={idx}>
                        <strong className="text-[#172033]">{term.slice(0, colonIdx + 1)}</strong>
                        {term.slice(colonIdx + 1)}
                      </li>
                    );
                  }
                  return <li key={idx}>{term}</li>;
                })}
              </ul>

              {/* Note */}
              <div className="bg-[#f4f6fb] border-l-[3px] border-[#3157d5] px-4 py-3.5 text-[#667085] text-[13px] mt-6">
                <strong className="text-[#172033]">Note:</strong> {quotation.note}
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-12 mt-12">
                <div className="border-t border-[#aeb6c5] pt-2.5 text-[#667085] text-[12px]">
                  For {quotation.preparedByName}
                  <br />
                  <br />
                  <strong className="text-[#172033]">{quotation.signatoryName}</strong>
                </div>
                <div className="border-t border-[#aeb6c5] pt-2.5 text-[#667085] text-[12px]">
                  <div>Accepted by {quotation.clientName || 'Client'}</div>

                  {!quotation.clientDecision ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setQuotation((prev) => ({
                            ...prev,
                            clientDecision: 'agreed',
                            clientDecisionAt: new Date().toISOString(),
                          }))
                        }
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold border transition cursor-pointer bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      >
                        Agreed
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQuotation((prev) => ({
                            ...prev,
                            clientDecision: 'rejected',
                            clientDecisionAt: new Date().toISOString(),
                          }))
                        }
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold border transition cursor-pointer bg-white text-rose-700 border-rose-300 hover:bg-rose-50"
                      >
                        Rejected
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-[0.4px] ${
                            quotation.clientDecision === 'agreed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {quotation.clientDecision === 'agreed' ? 'Agreed' : 'Rejected'}
                        </span>
                        {quotation.clientDecisionAt && (
                          <span className="text-[11px] text-[#667085]">
                            on{' '}
                            {new Date(quotation.clientDecisionAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-[#667085] print:hidden">
                        Response locked. Request a new quotation for changes.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <footer className="border-t border-[#e5e9f0] mt-11 pt-4 text-[#667085] text-[11px] text-center">
                Thank you for choosing {quotation.preparedByName}.
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Quotations;
