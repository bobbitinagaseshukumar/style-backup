import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../../components/common/Button';
import api from '../../config/api';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import {
  FiEdit, FiTrash2, FiPlus, FiSearch, FiX, FiAlertTriangle,
  FiEye, FiHome, FiCheck, FiStar, FiTrendingUp, FiZap, FiPackage, FiFilter,
  FiRefreshCw, FiCopy, FiChevronLeft, FiChevronRight, FiDownload,
  FiEyeOff, FiArchive, FiTag, FiImage, FiCheckCircle, FiArrowUp,
  FiArrowDown, FiGrid, FiList, FiMoreVertical, FiMaximize2,
  FiChevronDown, FiLayers
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import ProductWizard from './ProductWizard';
import { formatImageUrl } from '../../utils/formatImageUrl';

const fadeInUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };

const STATUS_MAP = {
  PUBLISHED: { label: 'Published', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600 border-gray-300' },
  HIDDEN: { label: 'Hidden', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  ARCHIVED: { label: 'Archived', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  DELETED: { label: 'Deleted', color: 'bg-red-50 text-red-600 border-red-200' },
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Latest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'name_asc', label: 'Name: A → Z' },
  { value: 'name_desc', label: 'Name: Z → A' },
  { value: 'stock_asc', label: 'Stock: Low → High' },
  { value: 'stock_desc', label: 'Stock: High → Low' },
];

const PAGE_SIZES = [10, 25, 50, 100];

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // View mode
  const [viewMode, setViewMode] = useState('TABLE');

  // Wizard modal
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Restock modal
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restocking, setRestocking] = useState(false);

  // Preview modal
  const [previewProduct, setPreviewProduct] = useState(null);
  const [previewImageIdx, setPreviewImageIdx] = useState(0);

  // Bulk selection
  const [selected, setSelected] = useState(new Set());

  // Actions dropdown
  const [actionDropdown, setActionDropdown] = useState(null);

  /* ─── FETCH PRODUCTS ────────────────────────────────────── */
  const fetchProducts = useCallback(async (isBackground = false) => {
    try {
      // Only show loading skeleton on initial load, NOT on background polling
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      const params = new URLSearchParams({
        includeAll: 'true',
        page: String(page),
        limit: String(pageSize),
        sort: sortBy,
      });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (search.trim()) params.set('search', search.trim());

      const [prodRes, catRes] = await Promise.allSettled([
        api.get(`/products?${params.toString()}`),
        api.get('/categories'),
      ]);

      if (prodRes.status === 'fulfilled') {
        const resData = prodRes.value.data;
        const d = resData?.data || resData;
        const prodList = Array.isArray(d) ? d : (d?.products || d?.data || []);
        setProducts(Array.isArray(prodList) ? prodList : []);
        setTotalProducts(d?.pagination?.total || prodList.length || 0);
        setTotalPages(d?.pagination?.pages || 1);
        setError(null);
      } else if (!isBackground) {
        setProducts([]);
        setError(null);
      }

      if (catRes.status === 'fulfilled') {
        setCategories(catRes.value.data?.data || []);
      }
    } catch (err) {
      if (!isBackground) {
        setError('Unable to load products. Please check your connection.');
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, statusFilter, categoryFilter, search]);

  // Initial fetch + background polling (every 30s instead of 15s to reduce load)
  useEffect(() => {
    fetchProducts(false); // Initial load with skeleton
    const interval = setInterval(() => {
      fetchProducts(true); // Background refresh, NO skeleton
    }, 30000);

    const handleFocus = () => fetchProducts(true); // Background refresh on focus
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchProducts]);


  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, categoryFilter, sortBy, pageSize]);

  /* ─── TOGGLE FLAGS ──────────────────────────────────────── */
  const handleToggleFlag = async (product, flag) => {
    const newValue = !product[flag];
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, [flag]: newValue } : p));
    try {
      await api.put(`/products/${product.id}`, { [flag]: newValue });
      toast.success(`${flag} ${newValue ? 'enabled' : 'disabled'} for "${product.name}"`);
    } catch { toast.error('Failed to update'); fetchProducts(); }
  };

  /* ─── CHANGE STATUS ─────────────────────────────────────── */
  const handleChangeStatus = async (product, newStatus) => {
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
    try {
      await api.put(`/products/${product.id}`, { status: newStatus });
      toast.success(`"${product.name}" → ${newStatus}`);
    } catch { toast.error('Failed to update status'); fetchProducts(); }
  };

  /* ─── DUPLICATE PRODUCT ─────────────────────────────────── */
  const handleDuplicate = async (product) => {
    try {
      const resolvedCategoryId = product.categoryId || product.category?.id || (categories.length > 0 ? categories[0].id : null);
      if (!resolvedCategoryId) {
        toast.error('Cannot duplicate: Please select a valid Category first.');
        return;
      }
      const dupData = {
        name: `${product.name} (Copy)`,
        sku: `${product.sku || 'SKU'}-copy-${Date.now().toString(36)}`,
        price: Number(product.price) || 0,
        discountPrice: Number(product.discountPrice) || 0,
        discountPercent: Number(product.discountPercent) || 0,
        stock: Number(product.stock) || 0,
        categoryId: resolvedCategoryId,
        subCategoryId: product.subCategoryId || product.subCategory?.id || null,
        brandId: product.brandId || product.brand?.id || null,
        description: product.description || '',
        shortDesc: product.shortDesc || '',
        sizes: typeof product.sizes === 'string' ? product.sizes : JSON.stringify(product.sizes || []),
        colors: typeof product.colors === 'string' ? product.colors : JSON.stringify(product.colors || []),
        status: 'DRAFT',
      };
      await api.post('/products', dupData);
      toast.success(`"${product.name}" duplicated as Draft!`);
      fetchProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'Duplicate failed'); }
  };

  /* ─── DELETE ────────────────────────────────────────────── */
  const handleDelete = async (hardDelete = false) => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.delete(`/products/${deleteTarget.id}${hardDelete ? '?hardDelete=true' : ''}`);
      toast.success(`"${deleteTarget.name}" ${hardDelete ? 'permanently deleted' : 'archived'}`);
      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      setSelected(prev => { const n = new Set(prev); n.delete(deleteTarget.id); return n; });
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const handleRestock = async () => {
    if (!restockTarget || !restockQty || parseInt(restockQty) <= 0) {
      toast.error('Enter a valid stock quantity');
      return;
    }
    try {
      setRestocking(true);
      const res = await api.post(`/products/${restockTarget.id}/restock`, { stock: parseInt(restockQty) });
      toast.success(res.data?.message || 'Product restocked!');
      setProducts(prev => prev.map(p => p.id === restockTarget.id ? { ...p, stock: parseInt(restockQty) } : p));
      setRestockTarget(null);
      setRestockQty('');
    } catch (err) { toast.error(err.response?.data?.message || 'Restock failed'); }
    finally { setRestocking(false); }
  };

  /* ─── BULK ACTIONS ──────────────────────────────────────── */
  const handleBulk = async (action) => {
    if (selected.size === 0) { toast.info('Select products first'); return; }
    const ids = [...selected];
    try {
      if (action === 'PUBLISH') await Promise.all(ids.map(id => api.put(`/products/${id}`, { status: 'PUBLISHED' })));
      else if (action === 'HIDE') await Promise.all(ids.map(id => api.put(`/products/${id}`, { status: 'HIDDEN' })));
      else if (action === 'ARCHIVE') await Promise.all(ids.map(id => api.put(`/products/${id}`, { status: 'ARCHIVED' })));
      else if (action === 'DRAFT') await Promise.all(ids.map(id => api.put(`/products/${id}`, { status: 'DRAFT' })));
      else if (action === 'DELETE') await Promise.all(ids.map(id => api.delete(`/products/${id}`)));
      toast.success(`Bulk ${action.toLowerCase()} applied to ${ids.length} products`);
      setSelected(new Set());
      fetchProducts();
    } catch { toast.error('Bulk action failed'); }
  };

  const getId = useCallback((p) => p?.id || p?._id, []);
  const toggleSelect = useCallback((id) => {
    if (!id) return;
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const selectAll = useCallback(() => setSelected(new Set(products.map(getId).filter(Boolean))), [products, getId]);

  /* ─── STATS ─────────────────────────────────────────────── */
  const stats = useMemo(() => ({
    total: totalProducts,
    published: products.filter(p => p.status === 'PUBLISHED').length,
    draft: products.filter(p => p.status === 'DRAFT').length,
    outOfStock: products.filter(p => p.stock === 0).length,
    featured: products.filter(p => p.featured).length,
  }), [products, totalProducts]);

  /* ─── GET IMAGE ─────────────────────────────────────────── */
  const getImage = (product) => {
    let raw = product.images?.find(i => i.isPrimary)?.url || product.images?.[0]?.url;
    if (!raw) {
      try {
        const colors = typeof product.colors === 'string' ? JSON.parse(product.colors) : product.colors;
        if (Array.isArray(colors)) {
          for (const c of colors) {
            if (c?.images?.[0]) {
              raw = typeof c.images[0] === 'string' ? c.images[0] : c.images[0]?.url;
              if (raw) break;
            }
          }
        }
      } catch {}
    }
    return formatImageUrl(raw, product.name);
  };

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">
      {/* ── HEADER ────────────────────────────────────────── */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Product Publishing & Inventory Control</h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalProducts} products in database • Manage visibility, pricing, badges & inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchProducts} className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition cursor-pointer" title="Refresh">
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <Button icon={FiPlus} onClick={() => { setEditingProduct(null); setWizardOpen(true); }}>Publish New Product</Button>
        </div>
      </motion.div>

      {/* ── STATS CARDS ───────────────────────────────────── */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Products', count: stats.total, color: 'text-blue-700 bg-blue-50 border-blue-100' },
          { label: 'Published', count: stats.published, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
          { label: 'Drafts', count: stats.draft, color: 'text-gray-700 bg-gray-100 border-gray-200' },
          { label: 'Out of Stock', count: stats.outOfStock, color: 'text-red-700 bg-red-50 border-red-100' },
          { label: 'Featured', count: stats.featured, color: 'text-amber-700 bg-amber-50 border-amber-100' },
        ].map(item => (
          <div key={item.label} className={`p-3.5 rounded-2xl border shadow-sm ${item.color}`}>
            <p className="text-xl font-black">{item.count}</p>
            <p className="text-[10px] font-bold opacity-80 mt-0.5">{item.label}</p>
          </div>
        ))}
      </motion.div>

      {/* ── TOOLBAR ───────────────────────────────────────── */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="flex flex-wrap items-center gap-2.5 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, SKU, brand..." className="w-full pl-8 pr-7 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"><FiX size={13} /></button>}
        </div>

        {/* Status Filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="ALL">All Status</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="HIDDEN">Hidden</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        {/* Category Filter */}
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 max-w-[160px]">
          <option value="ALL">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
          {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* View Mode */}
        <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg ml-auto">
          <button onClick={() => setViewMode('TABLE')} className={`p-1.5 rounded-md transition cursor-pointer ${viewMode === 'TABLE' ? 'bg-white text-black shadow-sm' : 'text-gray-400'}`}><FiList size={14} /></button>
          <button onClick={() => setViewMode('GRID')} className={`p-1.5 rounded-md transition cursor-pointer ${viewMode === 'GRID' ? 'bg-white text-black shadow-sm' : 'text-gray-400'}`}><FiGrid size={14} /></button>
        </div>
      </motion.div>

      {/* ── BULK ACTIONS ──────────────────────────────────── */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 p-3 rounded-2xl">
            <span className="text-xs font-bold text-amber-800">{selected.size} selected</span>
            <div className="flex items-center gap-1 ml-auto flex-wrap">
              <button onClick={() => handleBulk('PUBLISH')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition cursor-pointer">Publish</button>
              <button onClick={() => handleBulk('HIDE')} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition cursor-pointer">Hide</button>
              <button onClick={() => handleBulk('DRAFT')} className="px-3 py-1.5 rounded-lg bg-gray-600 text-white text-[10px] font-bold hover:bg-gray-700 transition cursor-pointer">Draft</button>
              <button onClick={() => handleBulk('ARCHIVE')} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-700 transition cursor-pointer">Archive</button>
              <button onClick={() => handleBulk('DELETE')} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-bold hover:bg-red-700 transition cursor-pointer">Delete</button>
              <button onClick={() => setSelected(new Set())} className="px-2 py-1.5 rounded-lg text-gray-500 text-[10px] font-bold hover:bg-gray-100 transition cursor-pointer">Clear</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT ──────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-gray-100" />
              <div className="flex-1 space-y-2"><div className="h-4 bg-gray-100 rounded w-48" /><div className="h-3 bg-gray-100 rounded w-32" /></div>
              <div className="w-20 h-8 bg-gray-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* ── ERROR STATE ───────────────────────────────────── */
        <div className="bg-white border border-red-100 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-100">
            <FiAlertTriangle size={32} />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Unable to load products</h3>
          <p className="text-sm text-gray-400 mb-5">{error}</p>
          <Button icon={FiRefreshCw} onClick={fetchProducts}>Retry</Button>
        </div>
      ) : products.length === 0 && statusFilter === 'ALL' && categoryFilter === 'ALL' && !search.trim() ? (
        /* ── EMPTY STATE (no products at all) ──────────────── */
        <motion.div variants={fadeInUp} initial="initial" animate="animate" className="bg-white border border-gray-100 rounded-3xl p-16 text-center shadow-sm">
          <div className="w-24 h-24 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-5 border border-amber-100">
            <FiPackage size={48} />
          </div>
          <h3 className="font-bold text-gray-900 text-xl mb-2">No products have been published yet.</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">Create your first product to start selling. Products will appear here immediately after creation.</p>
          <Button icon={FiPlus} onClick={() => { setEditingProduct(null); setWizardOpen(true); }}>Publish Your First Product</Button>
        </motion.div>
      ) : products.length === 0 ? (
        /* ── NO MATCH AFTER FILTERING ─────────────────────── */
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <FiSearch size={40} className="text-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-gray-900 text-base mb-1">No products found matching filters</h3>
          <p className="text-xs text-gray-400 mb-4">Try adjusting your search, status, or category filters.</p>
          <button onClick={() => { setSearch(''); setStatusFilter('ALL'); setCategoryFilter('ALL'); }} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition cursor-pointer">Clear All Filters</button>
        </div>
      ) : viewMode === 'GRID' ? (
        /* ═══════ GRID VIEW ═══════════════════════════════════ */
        <div>
          {/* Select All */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selected.size === products.length && products.length > 0} onChange={() => selected.size === products.length ? setSelected(new Set()) : selectAll()} className="rounded text-amber-500 cursor-pointer" />
              <span className="text-xs font-semibold text-gray-500">Select All ({products.length})</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map(product => {
              const img = getImage(product);
              const st = STATUS_MAP[product.status] || STATUS_MAP.PUBLISHED;

              return (
                <motion.div key={product.id} variants={fadeInUp} initial="initial" animate="animate"
                  className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-lg transition-all group ${selected.has(product.id) ? 'border-amber-400 ring-2 ring-amber-200' : 'border-gray-200'}`}>

                  {/* Image */}
                  <div className="relative aspect-square bg-gray-100 overflow-hidden">
                    {img ? (
                      <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><FiImage size={40} className="text-gray-300" /></div>
                    )}
                    {/* Overlay badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {product.featured && <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black text-[9px] font-extrabold">⭐ FEATURED</span>}
                      {product.bestSeller && <span className="px-1.5 py-0.5 rounded bg-purple-500 text-white text-[9px] font-extrabold">🏆 BEST SELLER</span>}
                      {product.trending && <span className="px-1.5 py-0.5 rounded bg-blue-500 text-white text-[9px] font-extrabold">🔥 TRENDING</span>}
                      {product.newArrival && <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-extrabold">✨ NEW</span>}
                      {product.flashSale && <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-extrabold">⚡ FLASH SALE</span>}
                    </div>
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selected.has(getId(product))}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(getId(product)); }}
                      className="absolute top-2 right-2 rounded text-amber-500 w-4 h-4 cursor-pointer z-10"
                    />
                    {/* Status badge */}
                    <span className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold border ${st.color}`}>{st.label}</span>
                    {/* Quick preview */}
                    <button onClick={() => { setPreviewProduct(product); setPreviewImageIdx(0); }} className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition cursor-pointer"><FiEye size={14} /></button>
                  </div>

                  {/* Info */}
                  <div className="p-3.5 space-y-2">
                    <h3 className="font-bold text-gray-900 text-xs truncate">{product.name}</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-black text-gray-900 text-sm">{formatCurrency(product.discountPrice || product.price)}</p>
                        {product.discountPrice > 0 && product.discountPrice < product.price && (
                          <p className="text-[10px] text-gray-400 line-through">{formatCurrency(product.price)}</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${product.stock === 0 ? 'bg-red-50 text-red-600 border-red-200' : product.stock < 10 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                        {product.stock === 0 ? 'Out of Stock' : `${product.stock} in stock`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold">
                      <span>{product.category?.name || '—'}</span>
                      {product.subCategory && <><span>›</span><span>{product.subCategory.name}</span></>}
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono">SKU: {product.sku}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
                      <button onClick={() => { setEditingProduct(product); setWizardOpen(true); }} className="flex-1 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold hover:bg-blue-100 transition cursor-pointer flex items-center justify-center gap-1"><FiEdit size={11} /> Edit</button>
                      {product.stock === 0 && <button onClick={() => { setRestockTarget(product); setRestockQty(''); }} className="flex-1 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1"><FiPackage size={11} /> Restock</button>}
                      <button onClick={() => handleDuplicate(product)} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer" title="Duplicate"><FiCopy size={12} /></button>
                      <button onClick={() => handleToggleFlag(product, 'showOnHomepage')} className={`p-1.5 rounded-lg transition cursor-pointer ${product.showOnHomepage ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-400'}`} title="Home Page"><FiHome size={12} /></button>
                      <button onClick={() => setDeleteTarget(product)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition cursor-pointer" title="Delete"><FiTrash2 size={12} /></button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ═══════ TABLE VIEW ══════════════════════════════════ */
        <div>
          {/* Select All */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selected.size === products.length && products.length > 0} onChange={() => selected.size === products.length ? setSelected(new Set()) : selectAll()} className="rounded text-amber-500 cursor-pointer" />
              <span className="text-xs font-semibold text-gray-500">Select All ({products.length})</span>
            </label>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase w-8"></th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Price & Stock</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Badges</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Home</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map(product => {
                    const img = getImage(product);
                    const st = STATUS_MAP[product.status] || STATUS_MAP.PUBLISHED;

                    return (
                      <tr key={product.id} className={`hover:bg-gray-50/70 transition ${selected.has(product.id) ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(getId(product))}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => { e.stopPropagation(); toggleSelect(getId(product)); }}
                            className="rounded text-amber-500 cursor-pointer z-10"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-200 cursor-pointer" onClick={() => { setPreviewProduct(product); setPreviewImageIdx(0); }}>
                              {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><FiImage size={16} className="text-gray-300" /></div>}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 text-xs truncate max-w-[200px]">{product.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{product.sku}</p>
                              {product.brand && <p className="text-[10px] text-gray-400">{product.brand.name}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <p className="font-semibold text-gray-900">{product.category?.name || '—'}</p>
                          <p className="text-[10px] text-gray-400">{product.subCategory?.name || ''}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-bold text-gray-900 text-xs">{formatCurrency(product.discountPrice || product.price)}</p>
                          {product.discountPrice > 0 && product.discountPrice < product.price && (
                            <p className="text-[10px] text-gray-400 line-through">{formatCurrency(product.price)}</p>
                          )}
                          <p className={`text-[10px] font-semibold mt-0.5 ${product.stock === 0 ? 'text-red-500' : product.stock < 10 ? 'text-amber-600' : 'text-gray-500'}`}>
                            {product.stock === 0 ? '⚠ Out of Stock' : `${product.stock} pcs`}
                          </p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <select value={product.status || 'PUBLISHED'} onChange={e => handleChangeStatus(product, e.target.value)}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold border outline-none cursor-pointer ${st.color}`}>
                            <option value="PUBLISHED">Published</option>
                            <option value="DRAFT">Draft</option>
                            <option value="HIDDEN">Hidden</option>
                            <option value="ARCHIVED">Archived</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-wrap gap-0.5 max-w-[160px]">
                            {[
                              { key: 'featured', emoji: '⭐', label: 'Featured', on: 'bg-amber-400 text-black border-amber-500' },
                              { key: 'trending', emoji: '🔥', label: 'Trending', on: 'bg-blue-500 text-white border-blue-600' },
                              { key: 'newArrival', emoji: '✨', label: 'New', on: 'bg-emerald-500 text-white border-emerald-600' },
                              { key: 'bestSeller', emoji: '🏆', label: 'Best', on: 'bg-purple-500 text-white border-purple-600' },
                              { key: 'flashSale', emoji: '⚡', label: 'Flash', on: 'bg-red-500 text-white border-red-600' },
                            ].map(b => (
                              <button key={b.key} onClick={() => handleToggleFlag(product, b.key)}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-bold border cursor-pointer transition ${product[b.key] ? b.on : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                                {b.emoji}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button onClick={() => handleToggleFlag(product, 'showOnHomepage')}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${product.showOnHomepage ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            <FiHome size={10} /> {product.showOnHomepage ? 'Yes' : 'No'}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-400">
                          {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setPreviewProduct(product); setPreviewImageIdx(0); }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition cursor-pointer" title="Preview"><FiEye size={13} /></button>
                            <button onClick={() => { setEditingProduct(product); setWizardOpen(true); }} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer" title="Edit"><FiEdit size={13} /></button>
                            <button onClick={() => handleDuplicate(product)} className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition cursor-pointer" title="Duplicate"><FiCopy size={13} /></button>
                            <button onClick={() => setDeleteTarget(product)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition cursor-pointer" title="Delete"><FiTrash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGINATION ────────────────────────────────────── */}
      {!loading && !error && totalProducts > 0 && (
        <motion.div variants={fadeInUp} initial="initial" animate="animate" className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Show</span>
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="px-2 py-1 rounded-lg border border-gray-200 text-xs font-semibold bg-white focus:outline-none">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-xs text-gray-500">per page</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-2">
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalProducts)} of {totalProducts}
            </span>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition cursor-pointer"><FiChevronLeft size={14} /></button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${page === p ? 'bg-amber-500 text-black shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>{p}</button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition cursor-pointer"><FiChevronRight size={14} /></button>
          </div>
        </motion.div>
      )}

      {/* ═══════ PRODUCT PREVIEW MODAL ═════════════════════════ */}
      <AnimatePresence>
        {previewProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 pointer-events-auto" onClick={() => setPreviewProduct(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-gray-100 overflow-hidden flex flex-col pointer-events-auto" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80 shrink-0">
                <div>
                  <h2 className="text-base font-black text-gray-900">{previewProduct.name}</h2>
                  <p className="text-[11px] text-gray-500 font-mono">SKU: {previewProduct.sku}</p>
                </div>
                <button onClick={() => setPreviewProduct(null)} className="p-2 rounded-xl hover:bg-gray-200 text-gray-500 transition cursor-pointer"><FiX size={20} /></button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Images */}
                  <div>
                    <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 mb-3">
                      {previewProduct.images?.length > 0 ? (
                        <img src={previewProduct.images[previewImageIdx]?.url} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><FiImage size={60} className="text-gray-300" /></div>
                      )}
                    </div>
                    {previewProduct.images?.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {previewProduct.images.map((img, i) => (
                          <button key={img.id} onClick={() => setPreviewImageIdx(i)}
                            className={`w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition cursor-pointer ${i === previewImageIdx ? 'border-amber-400' : 'border-gray-200'}`}>
                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      {previewProduct.featured && <span className="px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-bold">⭐ Featured</span>}
                      {previewProduct.bestSeller && <span className="px-2 py-0.5 rounded-md bg-purple-500 text-white text-[10px] font-bold">🏆 Best Seller</span>}
                      {previewProduct.trending && <span className="px-2 py-0.5 rounded-md bg-blue-500 text-white text-[10px] font-bold">🔥 Trending</span>}
                      {previewProduct.newArrival && <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-bold">✨ New Arrival</span>}
                      {previewProduct.flashSale && <span className="px-2 py-0.5 rounded-md bg-red-500 text-white text-[10px] font-bold">⚡ Flash Sale</span>}
                    </div>

                    <div>
                      <p className="text-2xl font-black text-gray-900">{formatCurrency(previewProduct.discountPrice || previewProduct.price)}</p>
                      {previewProduct.discountPrice > 0 && previewProduct.discountPrice < previewProduct.price && (
                        <p className="text-sm text-gray-400 line-through">{formatCurrency(previewProduct.price)} <span className="text-emerald-600 font-bold no-underline">({previewProduct.discountPercent}% off)</span></p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Category</p>
                        <p className="text-xs font-bold text-gray-900">{typeof previewProduct.category === 'object' ? (previewProduct.category?.name || '—') : (previewProduct.category || '—')}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Subcategory</p>
                        <p className="text-xs font-bold text-gray-900">{typeof previewProduct.subCategory === 'object' ? (previewProduct.subCategory?.name || '—') : (previewProduct.subCategory || '—')}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Brand</p>
                        <p className="text-xs font-bold text-gray-900">{typeof previewProduct.brand === 'object' ? (previewProduct.brand?.name || '—') : (previewProduct.brand || '—')}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Stock</p>
                        <p className={`text-xs font-bold ${previewProduct.stock === 0 ? 'text-red-600' : 'text-emerald-600'}`}>{previewProduct.stock === 0 ? 'Out of Stock' : `${previewProduct.stock} available`}</p>
                      </div>
                    </div>

                    {(() => {
                      try {
                        const raw = typeof previewProduct.sizes === 'string' ? JSON.parse(previewProduct.sizes || '[]') : (previewProduct.sizes || []);
                        const s = Array.isArray(raw) ? raw : [raw];
                        return s.length > 0 ? (
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Available Sizes</p>
                            <div className="flex flex-wrap gap-1">
                              {s.map((sz, i) => {
                                const txt = typeof sz === 'object' ? (sz?.label || sz?.name || sz?.size || sz?.value || JSON.stringify(sz)) : String(sz);
                                return <span key={i} className="px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-bold text-gray-700 border border-gray-200">{txt}</span>;
                              })}
                            </div>
                          </div>
                        ) : null;
                      } catch { return null; }
                    })()}

                    {(() => {
                      try {
                        const raw = typeof previewProduct.colors === 'string' ? JSON.parse(previewProduct.colors || '[]') : (previewProduct.colors || []);
                        const c = Array.isArray(raw) ? raw : [raw];
                        return c.length > 0 ? (
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Available Colors</p>
                            <div className="flex flex-wrap gap-1">
                              {c.map((cl, i) => {
                                const txt = typeof cl === 'object' ? (cl?.label || cl?.name || cl?.color || cl?.value || JSON.stringify(cl)) : String(cl);
                                return <span key={i} className="px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-bold text-gray-700 border border-gray-200">{txt}</span>;
                              })}
                            </div>
                          </div>
                        ) : null;
                      } catch { return null; }
                    })()}

                    {previewProduct.shortDesc && (
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Short Description</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{previewProduct.shortDesc}</p>
                      </div>
                    )}

                    {previewProduct.description && (
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Full Description</p>
                        <div className="text-xs text-gray-600 leading-relaxed max-h-32 overflow-y-auto bg-gray-50 p-3 rounded-xl border" dangerouslySetInnerHTML={{ __html: previewProduct.description }} />
                      </div>
                    )}

                    <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                      <p>Created: {previewProduct.createdAt ? new Date(previewProduct.createdAt).toLocaleString() : '—'}</p>
                      <p>Updated: {previewProduct.updatedAt ? new Date(previewProduct.updatedAt).toLocaleString() : '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-100 flex justify-end items-center gap-2 shrink-0 bg-gray-50/50">
                <button onClick={() => { setEditingProduct(previewProduct); setPreviewProduct(null); setWizardOpen(true); }} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer flex items-center gap-1"><FiEdit size={12} /> Edit Product</button>
                <button onClick={() => { setDeleteTarget(previewProduct); setPreviewProduct(null); }} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition cursor-pointer flex items-center gap-1"><FiTrash2 size={12} /> Delete Product</button>
                <button onClick={() => setPreviewProduct(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-100 transition cursor-pointer">Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════ DELETE CONFIRMATION MODAL ═════════════════════ */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 pointer-events-auto" onClick={() => setDeleteTarget(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 pointer-events-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                  <FiAlertTriangle className="text-red-600 w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Delete Product</h3>
                  <p className="text-xs text-gray-500">Are you sure you want to permanently delete this product?</p>
                </div>
              </div>

              {getImage(deleteTarget) && <img src={getImage(deleteTarget)} alt="" className="w-full h-24 object-cover rounded-2xl mb-3 border" />}

              <p className="text-xs text-gray-700 mb-5 bg-red-50 border border-red-100 rounded-xl p-3">
                Permanently delete <strong>&quot;{deleteTarget.name}&quot;</strong>? This will remove it immediately from the website and database.
              </p>

              <div className="flex flex-col gap-2">
                <button onClick={() => handleDelete(true)} disabled={deleting} className="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition shadow-sm cursor-pointer">
                  {deleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
                <button onClick={() => handleDelete(false)} disabled={deleting} className="w-full py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition cursor-pointer">
                  📦 Soft Delete (Hide Only)
                </button>
                <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="w-full py-2 rounded-xl text-gray-500 text-xs font-semibold hover:bg-gray-100 transition mt-1 cursor-pointer">
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════ RESTOCK MODAL ═════════════════════════════════ */}
      <AnimatePresence>
        {restockTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 pointer-events-auto" onClick={() => { setRestockTarget(null); setRestockQty(''); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 pointer-events-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <FiPackage className="text-emerald-600 w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Restock Product</h3>
                  <p className="text-xs text-gray-500">Set new stock for "{restockTarget.name}"</p>
                </div>
              </div>

              <p className="text-xs text-emerald-700 mb-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                📧 Customers who clicked "Notify Me" will automatically receive a <strong>back-in-stock email</strong> when you restock.
              </p>

              <input
                type="number"
                value={restockQty}
                onChange={e => setRestockQty(e.target.value)}
                placeholder="Enter new stock quantity"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none mb-4"
                min="1"
                autoFocus
              />

              <div className="flex flex-col gap-2">
                <button onClick={handleRestock} disabled={restocking || !restockQty}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition shadow-sm cursor-pointer disabled:opacity-50">
                  {restocking ? 'Restocking...' : `📦 Restock & Subscribe`}
                </button>
                <button onClick={() => { setRestockTarget(null); setRestockQty(''); }} disabled={restocking}
                  className="w-full py-2 rounded-xl text-gray-500 text-xs font-semibold hover:bg-gray-100 transition cursor-pointer">
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════ PRODUCT WIZARD MODAL ═════════════════════════ */}
      <AnimatePresence>
        {wizardOpen && (
          <ProductWizard
            editProduct={editingProduct}
            onClose={() => { setWizardOpen(false); setEditingProduct(null); }}
            onSaved={fetchProducts}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminProducts;
