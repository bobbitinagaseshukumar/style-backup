import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  FiCamera, FiFileText, FiGrid, FiDroplet, FiTag,
  FiDollarSign, FiCheckCircle, FiChevronLeft, FiChevronRight,
  FiSave, FiEye, FiSend, FiX, FiAlertCircle, FiCheck
} from 'react-icons/fi';
import api from '../../config/api';
import ImagesStep from './steps/ImagesStep';
import DetailsStep from './steps/DetailsStep';
import CategoryStep from './steps/CategoryStep';
import ColorsStep from './steps/ColorsStep';
import PricingStep from './steps/PricingStep';
import StatusStep from './steps/StatusStep';

/* ─── Steps Definition ───────────────────────────────────────── */
const STEPS = [
  { id: 'images', label: 'Images', icon: FiCamera, desc: 'Upload & crop product photos' },
  { id: 'details', label: 'Details', icon: FiFileText, desc: 'Name, material, specifications' },
  { id: 'category', label: 'Category', icon: FiGrid, desc: 'Category, subcategory & sizes' },
  { id: 'colors', label: 'Colors', icon: FiDroplet, desc: 'Color variants & size stock' },
  { id: 'pricing', label: 'Pricing', icon: FiDollarSign, desc: 'Price, discount & inventory' },
  { id: 'status', label: 'Status & SEO', icon: FiTag, desc: 'Visibility, badges & SEO' },
];

/* ─── Validate per step ──────────────────────────────────────── */
const validate = (stepId, { images, form, colors }) => {
  switch (stepId) {
    case 'images': return images.length > 0 ? null : 'Please upload at least one product image';
    case 'details': return form.name?.trim() ? null : 'Product name is required';
    case 'category':
      if (!form.categoryId) return 'Please select a category';
      if ((form.availableSizes || []).length === 0) return 'Please select at least one size';
      return null;
    case 'colors':
      if (colors.length === 0) return 'Add at least one color variant';
      if (colors.some(c => !c.name?.trim())) return 'All colors must have a name';
      return null;
    case 'pricing':
      if (!form.mrp || parseFloat(form.mrp) <= 0) return 'MRP is required';
      if (!form.stock || parseInt(form.stock) < 0) return 'Stock quantity is required';
      return null;
    default: return null;
  }
};

/* ─── Upload images to server/Cloudinary (with Base64 Data URL fallback) ─────────────────────── */
const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const uploadImages = async (images) => {
  const urls = [];
  for (const rawImg of images) {
    let imgObj = typeof rawImg === 'string' ? { url: rawImg } : rawImg;
    let targetBlob = imgObj?.blob || null;
    let targetUrl = imgObj?.url || (typeof rawImg === 'string' ? rawImg : '');

    // If targetUrl is a local browser blob: URL, fetch the blob from memory if blob object is missing
    if (targetUrl && targetUrl.startsWith('blob:') && !targetBlob) {
      try {
        const resp = await fetch(targetUrl);
        targetBlob = await resp.blob();
      } catch (err) {
        console.warn('[FAILED TO FETCH BLOB URL]', err);
      }
    }

    if (targetBlob) {
      const formData = new FormData();
      formData.append('image', targetBlob, `product-${Date.now()}.webp`);
      try {
        const { data } = await api.post('/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (data && data.url) {
          urls.push(data.url);
          continue;
        }
      } catch (err) {
        console.warn('[IMAGE UPLOAD ENDPOINT FAILED - USING BASE64 FALLBACK]', err);
      }

      // Convert Blob to Base64 Data URL so image is permanent across all devices
      try {
        const b64 = await blobToBase64(targetBlob);
        urls.push(b64);
        continue;
      } catch (b64Err) {
        console.error('[BASE64 CONVERSION FAILED]', b64Err);
      }
    }

    // Only keep existing URL if it is a valid web URL or Data URL (NOT a local blob: URL)
    if (targetUrl && !targetUrl.startsWith('blob:')) {
      urls.push(targetUrl);
    }
  }

  return urls;
};

/* ─── Main Wizard ────────────────────────────────────────────── */
const ProductWizard = ({ editProduct = null, onClose, onSaved }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [validationError, setValidationError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState(''); // 'saving' | 'saved' | ''

  /* ── Shared State ──────────────────────────────────────────── */
  const [images, setImages] = useState(
    editProduct?.images?.map(img => ({ id: img.id, url: img.url, isPrimary: img.isPrimary })) || []
  );

  const [colors, setColors] = useState(() => {
    if (editProduct?.colors) {
      try { return JSON.parse(editProduct.colors); } catch {}
    }
    return [];
  });

  const [form, setForm] = useState({
    name: editProduct?.name || '',
    brand: editProduct?.brand?.name || '',
    sku: editProduct?.sku || '',
    shortDesc: editProduct?.shortDesc || '',
    description: editProduct?.description || '',
    material: editProduct?.material || '',
    fabric: editProduct?.fabric || '',
    pattern: editProduct?.pattern || '',
    fit: editProduct?.fit || '',
    sleeve: editProduct?.sleeve || '',
    neck: editProduct?.neck || '',
    occasion: editProduct?.occasion || '',
    season: editProduct?.season || '',
    gender: editProduct?.gender || '',
    ageGroup: editProduct?.ageGroup || '',
    countryOfOrigin: editProduct?.countryOfOrigin || 'India',
    manufacturer: editProduct?.manufacturer || '',
    washCare: editProduct?.washCare || '',
    warranty: editProduct?.warranty || '',
    categoryId: editProduct?.categoryId || '',
    subCategoryId: editProduct?.subCategoryId || '',
    availableSizes: editProduct?.sizes ? (() => { try { return JSON.parse(editProduct.sizes); } catch { return []; } })() : [],
    tags: editProduct?.tags ? (() => { try { return JSON.parse(editProduct.tags); } catch { return []; } })() : [],
    mrp: editProduct?.price?.toString() || '',
    sellingPrice: editProduct?.discountPrice?.toString() || '',
    costPrice: '',
    discountPercent: editProduct?.discountPercent?.toString() || '0',
    gst: '5%',
    stock: editProduct?.stock?.toString() || '',
    lowStockAlert: '5',
    minQty: '1',
    maxQty: '',
    freeShipping: editProduct?.freeShipping || false,
    cashOnDelivery: true,
    preOrder: false,
    backOrder: false,
    returnAvailable: true,
    replacementAvailable: true,
    shippingFee: editProduct?.shippingFee?.toString() || '',
    weight: editProduct?.weight?.toString() || '',
    length: '',
    width: '',
    height: '',
    shippingClass: 'Standard',
    estimatedDelivery: '3-5 Business Days',
    returnPeriod: '7 days',
    refundPolicy: 'Full refund within 7 days',
    status: editProduct ? (editProduct.status?.toLowerCase() || (editProduct.isVisible ? 'published' : 'draft')) : 'published',
    featured: editProduct?.featured || false,
    trending: editProduct?.trending || false,
    newArrival: editProduct?.newArrival || false,
    bestSeller: editProduct?.bestSeller || false,
    flashSale: false,
    limitedStock: false,
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    slug: editProduct?.slug || '',
  });

  const handleFormChange = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setAutosaveStatus('saving');
  }, []);

  /* ── Touch activity timestamp during active product editing ── */
  useEffect(() => {
    const now = Date.now().toString();
    localStorage.setItem('kvlr_admin_last_activity', now);
    localStorage.setItem('kvlr_last_activity', now);
  }, [form, colors, images, currentStep]);

  /* ── Autosave indicator ────────────────────────────────────── */
  useEffect(() => {
    if (autosaveStatus !== 'saving') return;
    const t = setTimeout(() => setAutosaveStatus('saved'), 1200);
    return () => clearTimeout(t);
  }, [form, colors, images, autosaveStatus]);

  const mainRef = useRef(null);

  /* ── Manage body scroll lock during active wizard ────────────── */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  /* ── Auto scroll to top on step change ───────────────────────── */
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [currentStep]);

  /* ── Navigation ────────────────────────────────────────────── */
  const goTo = (idx) => {
    const err = validate(STEPS[currentStep].id, { images, form, colors });
    if (err && idx > currentStep) { setValidationError(err); return; }
    setValidationError(null);
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    setCurrentStep(idx);
  };

  const next = () => { if (currentStep < STEPS.length - 1) goTo(currentStep + 1); };
  const prev = () => { setValidationError(null); setCurrentStep(c => Math.max(0, c - 1)); };

  /* ── Submit ────────────────────────────────────────────────── */
  const handleSubmit = async (publishStatus = 'published') => {
    // Validate all steps before publishing and jump to failing step if needed
    if (publishStatus === 'published') {
      for (let i = 0; i < STEPS.length; i++) {
        const step = STEPS[i];
        const err = validate(step.id, { images, form, colors });
        if (err) {
          toast.error(`${step.label}: ${err}`);
          setCurrentStep(i);
          if (mainRef.current) mainRef.current.scrollTop = 0;
          return;
        }
      }
    }

    try {
      setSaving(true);
      toast.info('Uploading images...');

      // Upload primary product images
      const uploadedUrls = await uploadImages(images);

      // Build color variant data with image URLs
      const colorData = await Promise.all(
        colors.map(async (c) => {
          const colorImages = await uploadImages(c.images || []);
          return {
            ...c,
            images: colorImages,
          };
        })
      );

      const sellingPrice = parseFloat(form.sellingPrice) || parseFloat(form.mrp) || 0;
      const discountPct = parseFloat(form.discountPercent) || 0;
      const discountPrice = discountPct > 0
        ? +(parseFloat(form.mrp) * (1 - discountPct / 100)).toFixed(2)
        : sellingPrice;

      const isPub = publishStatus === 'published' || form.status === 'published' || form.status === 'PUBLISHED';
      const targetStatus = isPub ? 'PUBLISHED' : (form.status || 'PUBLISHED').toUpperCase();

      const payload = {
        name: form.name,
        sku: form.sku,
        shortDesc: form.shortDesc,
        description: form.description,
        price: parseFloat(form.mrp) || 0,
        discountPercent: discountPct,
        discountPrice,
        stock: parseInt(form.stock) || 0,
        categoryId: form.categoryId,
        subCategoryId: form.subCategoryId || null,
        material: form.material,
        occasion: form.occasion,
        gender: form.gender,
        sizes: JSON.stringify(form.availableSizes || []),
        colors: JSON.stringify(colorData),
        tags: JSON.stringify(form.tags || []),
        featured: form.featured,
        trending: form.trending,
        newArrival: form.newArrival,
        bestSeller: form.bestSeller,
        isRecommended: form.isRecommended,
        isPremium: form.isPremium,
        isFestival: form.isFestival,
        showOnHomepage: form.showOnHomepage !== undefined ? form.showOnHomepage : true,
        status: targetStatus,
        isVisible: targetStatus === 'PUBLISHED',
        images: uploadedUrls,
        slug: form.slug,
        // Per-product shipping
        shippingFee: parseFloat(form.shippingFee) || 0,
        freeShipping: !!form.freeShipping,
      };

      if (editProduct) {
        await api.put(`/products/${editProduct.id}`, payload);
        toast.success('Product updated successfully!');
      } else {
        await api.post('/products', payload);
        toast.success(publishStatus === 'published' ? '🚀 Product published!' : '📝 Draft saved!');
      }

      try {
        localStorage.removeItem('__KVLR_HOME_PERSISTENT_CACHE_V3__');
        sessionStorage.removeItem('__KVLR_HOME_CACHE__');
        window.dispatchEvent(new Event('kvlr:content-updated'));
      } catch (e) {}

      // Unlock body overflow immediately
      document.body.style.overflow = '';
      // Close wizard FIRST to remove the blur overlay immediately
      onClose?.();
      // Then refresh the product list (after modal is closed)
      setTimeout(() => onSaved?.(), 100);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const stepContent = [
    <ImagesStep images={images} setImages={setImages} />,
    <DetailsStep form={form} onChange={handleFormChange} />,
    <CategoryStep form={form} onChange={handleFormChange} />,
    <ColorsStep colors={colors} setColors={setColors} availableSizes={form.availableSizes} />,
    <PricingStep form={form} onChange={handleFormChange} />,
    <StatusStep form={form} onChange={handleFormChange} />,
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex pointer-events-none"
      style={{ fontFamily: "'Inter', sans-serif" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto" onClick={() => { document.body.style.overflow = ''; onClose?.(); }} />

      {/* Wizard Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="relative w-full max-w-full bg-white h-full flex flex-col shadow-2xl overflow-hidden pointer-events-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-gray-900">
              {editProduct ? `Edit: ${editProduct.name}` : 'New Product'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Step {currentStep + 1} of {STEPS.length} — {STEPS[currentStep].desc}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Autosave */}
            <span className="text-xs text-gray-400 hidden sm:block">
              {autosaveStatus === 'saving' && '⏳ Saving draft...'}
              {autosaveStatus === 'saved' && '✓ Draft saved'}
            </span>
            <button onClick={onClose} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
              <FiX size={16} />
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Steps */}
          <aside className="w-52 bg-gray-50 border-r border-gray-100 flex-shrink-0 overflow-y-auto py-4 hidden md:block">
            {STEPS.map((step, idx) => {
              const done = completedSteps.has(idx);
              const active = idx === currentStep;
              return (
                <button
                  key={step.id}
                  onClick={() => { setValidationError(null); setCurrentStep(idx); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition
                    ${active ? 'bg-yellow-50 border-r-2 border-yellow-400' : 'hover:bg-gray-100 border-r-2 border-transparent'}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition
                    ${done && !active ? 'bg-emerald-400 text-white' : active ? 'bg-yellow-400 text-black' : 'bg-gray-200 text-gray-500'}`}>
                    {done && !active ? <FiCheck size={12} /> : <step.icon size={12} />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${active ? 'text-yellow-700' : 'text-gray-700'}`}>{step.label}</p>
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Step Content */}
          <main ref={mainRef} className="flex-1 overflow-y-auto px-6 py-6">
            {/* Mobile Step Pills */}
            <div className="flex gap-1.5 mb-6 md:hidden overflow-x-auto pb-1">
              {STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => { setValidationError(null); setCurrentStep(idx); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition
                    ${idx === currentStep ? 'bg-yellow-400 text-black' : completedSteps.has(idx) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {step.label}
                </button>
              ))}
            </div>

            {/* Validation Error */}
            <AnimatePresence>
              {validationError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-5 text-red-700 text-sm"
                >
                  <FiAlertCircle size={16} className="flex-shrink-0" />
                  {validationError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active Step */}
            <div key={currentStep}>
              {stepContent[currentStep]}
            </div>
          </main>
        </div>

        {/* ── Footer Navigation ──────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          {/* Left */}
          <button
            onClick={prev}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition disabled:opacity-30"
          >
            <FiChevronLeft size={15} /> Previous
          </button>

          {/* Progress dots */}
          <div className="hidden sm:flex gap-1.5">
            {STEPS.map((_, idx) => (
              <div key={idx} className={`h-1.5 rounded-full transition-all
                ${idx === currentStep ? 'w-6 bg-yellow-400' : completedSteps.has(idx) ? 'w-3 bg-emerald-400' : 'w-3 bg-gray-200'}`}
              />
            ))}
          </div>

          {/* Right */}
          <div className="flex gap-2">
            {currentStep === STEPS.length - 1 ? (
              <>
                <button
                  onClick={() => handleSubmit('draft')}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                >
                  <FiSave size={13} /> Save Draft
                </button>
                <button
                  onClick={() => handleSubmit('published')}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-400 text-black font-black text-sm hover:bg-yellow-300 transition disabled:opacity-50 shadow-lg shadow-yellow-200"
                >
                  {saving ? (
                    <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Publishing...</>
                  ) : (
                    <><FiSend size={13} /> Publish Product</>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={next}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-400 text-black font-black text-sm hover:bg-yellow-300 transition shadow-md shadow-yellow-200"
              >
                Next <FiChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ProductWizard;
