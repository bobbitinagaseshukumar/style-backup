import React, { useState, useEffect, useMemo } from 'react';
import api from '../../config/api';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import {
  FiBox, FiAlertTriangle, FiEdit2, FiTrash2, FiXCircle,
  FiSearch, FiRefreshCw, FiCheckCircle, FiLayers, FiZap,
  FiTrendingUp, FiTrendingDown, FiBarChart2, FiCalendar
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/formatCurrency';

const AdminInventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | IN_STOCK | LOW_STOCK | OUT_OF_STOCK

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newStock, setNewStock] = useState('0');
  const [updating, setUpdating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Phase 11 — AI Inventory Intelligence States
  const [aiViewActive, setAiViewActive] = useState(true);
  const [selectedDays, setSelectedDays] = useState(30);
  const [intelligenceData, setIntelligenceData] = useState(null);
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);
  const [intelligenceSubTab, setIntelligenceSubTab] = useState('stockout'); // stockout | fast | slow | rising

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products?limit=200&includeAll=true');
      const list = res.data?.data?.products || res.data?.products || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setProducts(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load inventory data:', err.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInventoryIntelligence = async (days = selectedDays) => {
    try {
      setLoadingIntelligence(true);
      const res = await api.get(`/admin/ai-inventory?days=${days}`);
      if (res.data?.success) {
        setIntelligenceData(res.data.data);
      }
    } catch (err) {
      console.warn('[AdminInventory] AI Intelligence notice:', err.message);
    } finally {
      setLoadingIntelligence(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchAIInventoryIntelligence(selectedDays);
  }, [selectedDays]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const nameMatch = (p.name || '').toLowerCase().includes(search.toLowerCase());
      const skuMatch = (p.sku || '').toLowerCase().includes(search.toLowerCase());
      const categoryMatch = (p.category?.name || '').toLowerCase().includes(search.toLowerCase());
      const matchesSearch = nameMatch || skuMatch || categoryMatch;

      const isOut = p.stock === 0;
      const isLow = p.stock > 0 && p.stock < 10;
      const isIn = p.stock >= 10;

      if (!matchesSearch) return false;
      if (statusFilter === 'OUT_OF_STOCK') return isOut;
      if (statusFilter === 'LOW_STOCK') return isLow;
      if (statusFilter === 'IN_STOCK') return isIn;
      return true;
    });
  }, [products, search, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = products.length;
    const low = products.filter((p) => p.stock > 0 && p.stock < 10).length;
    const out = products.filter((p) => p.stock === 0).length;
    const inStock = products.filter((p) => p.stock >= 10).length;
    return { total, low, out, inStock };
  }, [products]);

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      setUpdating(true);
      const parsedStock = Math.max(0, parseInt(newStock) || 0);
      await api.put(`/products/${selectedProduct.id}`, { stock: parsedStock });
      toast.success(`Stock for '${selectedProduct.name}' updated to ${parsedStock} pcs!`);
      setSelectedProduct(null);
      fetchInventory();
      fetchAIInventoryIntelligence(selectedDays);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stock');
    } finally {
      setUpdating(false);
    }
  };

  const handleQuickAdd = (addQty) => {
    const curr = parseInt(newStock) || 0;
    setNewStock(String(curr + addQty));
  };

  const handleSetOutOfStock = async (product) => {
    if (!window.confirm(`Set stock level to 0 (OUT OF STOCK) for '${product.name}'?`)) return;
    try {
      await api.put(`/products/${product.id}`, { stock: 0 });
      toast.info(`'${product.name}' is now marked OUT OF STOCK.`);
      fetchInventory();
      fetchAIInventoryIntelligence(selectedDays);
    } catch (err) {
      toast.error('Failed to update stock level');
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.delete(`/products/${deleteTarget.id}`);
      toast.success(`Deleted stock item '${deleteTarget.name}' successfully.`);
      setDeleteTarget(null);
      fetchInventory();
      fetchAIInventoryIntelligence(selectedDays);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete stock item');
    } finally {
      setDeleting(false);
    }
  };

  const handleResetAllStocks = async () => {
    if (!window.confirm('⚠️ Are you sure you want to reset ALL product stock levels to 0?')) return;
    try {
      setLoading(true);
      await api.put('/products/admin/reset-all-stocks');
      toast.info('All product stock levels have been reset to 0 pcs.');
      fetchInventory();
      fetchAIInventoryIntelligence(selectedDays);
    } catch (err) {
      toast.error('Failed to reset all stocks');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <FiBox className="text-gold-600" /> Inventory & Demand Intelligence
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Real sales history analytics + AI stockout forecasting & demand velocity monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiViewActive(!aiViewActive)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
              aiViewActive ? 'bg-gold-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FiZap /> {aiViewActive ? 'AI Intelligence Active' : 'Show AI Intelligence'}
          </button>
          <button
            onClick={handleResetAllStocks}
            className="px-3.5 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold hover:bg-red-100 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Reset all product stocks to 0"
          >
            <FiXCircle className="w-4 h-4" /> Reset All (0)
          </button>
          <button
            onClick={() => {
              fetchInventory();
              fetchAIInventoryIntelligence(selectedDays);
            }}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            title="Refresh Data"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading || loadingIntelligence ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── PHASE 11: AI SMART INVENTORY & DEMAND FORECASTING DASHBOARD ─────── */}
      {aiViewActive && (
        <div className="bg-gradient-to-r from-charcoal-900 via-black to-charcoal-900 rounded-3xl p-5 sm:p-6 text-white border border-gold-500/40 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gold-500/20 border border-gold-500/50 text-gold-400 flex items-center justify-center text-xl shrink-0">
                <FiBarChart2 />
              </div>
              <div>
                <h2 className="text-base font-serif font-bold text-amber-300">AI Inventory Intelligence & Demand Forecasting</h2>
                <p className="text-xs text-gray-400">Decision support calculated strictly from real PostgreSQL completed orders.</p>
              </div>
            </div>

            {/* Time period filter buttons */}
            <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-2xl border border-white/10">
              {[7, 30, 90, 180, 365].map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDays(d)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedDays === d ? 'bg-amber-400 text-black' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {d === 365 ? '1 Year' : `${d}D`}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Critical Stockout Risk</span>
              <p className="text-xl font-black text-red-400">
                {intelligenceData?.summary?.criticalStockoutCount || 0} Products
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Fast-Moving Demand</span>
              <p className="text-xl font-black text-emerald-400">
                {intelligenceData?.summary?.fastMovingCount || 0} Items
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Units Sold ({selectedDays}D)</span>
              <p className="text-xl font-black text-amber-300">
                {intelligenceData?.summary?.totalUnitsSold || 0} pcs
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Sales Revenue</span>
              <p className="text-xl font-black text-gold-400">
                {formatCurrency(intelligenceData?.summary?.totalRevenue || 0)}
              </p>
            </div>
          </div>

          {/* AI Executive Summary Box */}
          {intelligenceData?.summary?.aiSummary && (
            <div className="p-4 rounded-2xl bg-gold-500/10 border border-gold-500/30 text-xs text-gray-200 space-y-1">
              <span className="font-bold text-amber-300 uppercase tracking-wider text-[10px] block">
                🧠 Executive Decision Summary ({intelligenceData.confidenceLevel?.replace('_', ' ')})
              </span>
              <p className="leading-relaxed">{intelligenceData.summary.aiSummary}</p>
            </div>
          )}

          {/* Sub-tab Selectors */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
            <button
              onClick={() => setIntelligenceSubTab('stockout')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                intelligenceSubTab === 'stockout' ? 'bg-red-500/30 text-red-300 border border-red-500/50' : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              <FiAlertTriangle className="w-3.5 h-3.5" /> Stockout Risk ({intelligenceData?.tables?.stockoutRisk?.length || 0})
            </button>
            <button
              onClick={() => setIntelligenceSubTab('fast')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                intelligenceSubTab === 'fast' ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50' : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              <FiTrendingUp className="w-3.5 h-3.5" /> Fast-Moving ({intelligenceData?.tables?.fastMoving?.length || 0})
            </button>
            <button
              onClick={() => setIntelligenceSubTab('slow')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                intelligenceSubTab === 'slow' ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50' : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              <FiTrendingDown className="w-3.5 h-3.5" /> Slow-Moving ({intelligenceData?.tables?.slowMoving?.length || 0})
            </button>
          </div>

          {/* Sub-tab Table Render */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-black/60 text-gray-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Current Stock</th>
                  <th className="p-3">Daily Velocity</th>
                  <th className="p-3">Est. Days Left</th>
                  <th className="p-3">Suggested Restock</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {(() => {
                  const targetList = intelligenceSubTab === 'stockout'
                    ? intelligenceData?.tables?.stockoutRisk
                    : intelligenceSubTab === 'fast'
                    ? intelligenceData?.tables?.fastMoving
                    : intelligenceData?.tables?.slowMoving;

                  if (!targetList || targetList.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-gray-500">
                          No products found for this inventory filter category.
                        </td>
                      </tr>
                    );
                  }

                  return targetList.slice(0, 10).map(p => (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="p-3 font-semibold text-white truncate max-w-[180px]">{p.name}</td>
                      <td className="p-3 text-gray-400">{p.category}</td>
                      <td className="p-3 font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          p.currentStock === 0 ? 'bg-red-500/30 text-red-300' : p.currentStock < 10 ? 'bg-amber-500/30 text-amber-300' : 'bg-emerald-500/30 text-emerald-300'
                        }`}>
                          {p.currentStock} pcs
                        </span>
                      </td>
                      <td className="p-3 font-bold text-amber-300">{p.dailyVelocity}/day</td>
                      <td className="p-3">
                        {p.estimatedDaysLeft === 0 ? (
                          <span className="text-red-400 font-bold">OUT OF STOCK</span>
                        ) : (
                          <span>~{p.estimatedDaysLeft} days</span>
                        )}
                      </td>
                      <td className="p-3 text-emerald-400 font-bold">+{p.suggestedRestock} pcs</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedProduct(p);
                            setNewStock(String(p.currentStock));
                          }}
                          className="px-2.5 py-1 rounded-lg bg-gold-500 hover:bg-gold-400 text-black font-bold text-[10px] transition cursor-pointer"
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Standard Inventory Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-charcoal-900 text-white border-charcoal-900 shadow-md'
              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Total Items</span>
            <FiLayers className="w-5 h-5 opacity-70" />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.total}</p>
        </div>

        <div
          onClick={() => setStatusFilter('IN_STOCK')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'IN_STOCK'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
              : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">In Stock</span>
            <FiCheckCircle className="w-5 h-5 opacity-70" />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.inStock}</p>
        </div>

        <div
          onClick={() => setStatusFilter('LOW_STOCK')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'LOW_STOCK'
              ? 'bg-amber-500 text-white border-amber-500 shadow-md'
              : 'bg-amber-50 text-amber-900 border-amber-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Low Stock (&lt;10)</span>
            <FiAlertTriangle className="w-5 h-5 opacity-70" />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.low}</p>
        </div>

        <div
          onClick={() => setStatusFilter('OUT_OF_STOCK')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'OUT_OF_STOCK'
              ? 'bg-red-600 text-white border-red-600 shadow-md'
              : 'bg-red-50 text-red-900 border-red-200 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Out of Stock</span>
            <FiXCircle className="w-5 h-5 opacity-70" />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.out}</p>
        </div>
      </div>

      {/* Controls: Search & Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search SKU, product name, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-gold-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-gray-600 w-full sm:w-auto justify-end">
          <span>Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs font-bold focus:outline-none"
          >
            <option value="ALL">All Products ({stats.total})</option>
            <option value="IN_STOCK">In Stock ({stats.inStock})</option>
            <option value="LOW_STOCK">Low Stock ({stats.low})</option>
            <option value="OUT_OF_STOCK">Out of Stock ({stats.out})</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="py-20 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
          <FiRefreshCw className="w-6 h-6 animate-spin text-gold-600" />
          <span>Fetching live database inventory records...</span>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3.5">Product</th>
                  <th className="px-4 py-3.5">SKU / Code</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Price</th>
                  <th className="px-4 py-3.5">Stock Level</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredProducts.map((p) => {
                  const isOut = p.stock === 0;
                  const isLow = p.stock > 0 && p.stock < 10;
                  const displayPrice = p.discountPrice || p.price;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3 font-semibold text-gray-900 max-w-xs truncate">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-500">
                        {p.sku || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.category?.name || 'General'}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {formatCurrency(displayPrice)}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1 ${
                          isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isOut ? '0 pcs (OUT OF STOCK)' : `${p.stock} pcs`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setNewStock(String(p.stock));
                            }}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gold-100 text-gray-600 hover:text-gold-800 transition cursor-pointer"
                            title="Edit Stock Level"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSetOutOfStock(p)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-amber-100 text-gray-600 hover:text-amber-800 transition cursor-pointer"
                            title="Set Out of Stock (0)"
                          >
                            <FiXCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 transition cursor-pointer"
                            title="Delete Stock Entry"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No stock entries match the current filter or search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {selectedProduct && (
        <Modal isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} title={`Adjust Stock — ${selectedProduct.name}`}>
          <form onSubmit={handleUpdateStock} className="space-y-4 text-xs">
            <div>
              <p className="text-xs text-gray-500 mb-2">SKU: <strong className="font-mono">{selectedProduct.sku}</strong></p>
              <Input
                label="Stock Quantity (pcs)"
                type="number"
                min="0"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1.5">Quick Stock Shortcuts:</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewStock('0')}
                  className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-bold hover:bg-red-200 transition cursor-pointer"
                >
                  Set 0 (Out of Stock)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(10)}
                  className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-bold hover:bg-blue-200 transition cursor-pointer"
                >
                  +10 pcs
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(50)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold hover:bg-emerald-200 transition cursor-pointer"
                >
                  +50 pcs
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setSelectedProduct(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updating}>
                {updating ? 'Saving...' : 'Save Stock Count'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete Stock Entry">
          <div className="space-y-4 text-xs">
            <p className="text-gray-700">
              Are you sure you want to delete <strong className="text-red-600">{deleteTarget.name}</strong> from stock/inventory? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminInventory;
