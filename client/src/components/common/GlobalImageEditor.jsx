import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiRotateCw, FiRotateCcw, FiZoomIn, FiZoomOut,
  FiCheck, FiRefreshCw, FiCrop, FiUploadCloud, FiGrid,
  FiMaximize2, FiSliders
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../config/api';

/* ─── Canvas helpers ─────────────────────────────────────────── */

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop, rotation = 0, flip = { horizontal: false, vertical: false }, quality = 0.82) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-safeArea / 2, -safeArea / 2);
  ctx.drawImage(image, safeArea / 2 - image.width / 2, safeArea / 2 - image.height / 2);

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  // Resize crop output canvas down to max 1200px for optimal performance and lightweight Base64 size (<120KB)
  let targetWidth = Math.max(1, Math.round(pixelCrop.width));
  let targetHeight = Math.max(1, Math.round(pixelCrop.height));
  const MAX_DIM = 1200;
  if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * MAX_DIM) / targetWidth);
      targetWidth = MAX_DIM;
    } else {
      targetWidth = Math.round((targetWidth * MAX_DIM) / targetHeight);
      targetHeight = MAX_DIM;
    }
  }

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = pixelCrop.width;
  cropCanvas.height = pixelCrop.height;
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetWidth;
  outCanvas.height = targetHeight;
  const outCtx = outCanvas.getContext('2d');
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(cropCanvas, 0, 0, pixelCrop.width, pixelCrop.height, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve) => {
    outCanvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
  });
}

/* ─── Grid overlay types ─────────────────────────────────────── */

const GRID_TYPES = [
  { id: 'none', label: 'Off', icon: null },
  { id: 'thirds', label: 'Rule of Thirds', icon: '⊞' },
  { id: 'center', label: 'Center Cross', icon: '＋' },
  { id: 'diagonal', label: 'Diagonal', icon: '╳' },
  { id: 'grid4x4', label: '4×4 Grid', icon: '▦' },
  { id: 'golden', label: 'Golden Ratio', icon: 'φ' },
];

/* ─── Grid Overlay Component (Pure SVG — never saved to image) ── */

const GridOverlay = ({ gridType, cropArea }) => {
  if (gridType === 'none' || !cropArea) return null;

  const { width, height, x, y } = cropArea;
  if (!width || !height) return null;

  const renderLines = () => {
    const lineStyle = { stroke: 'rgba(255,255,255,0.55)', strokeWidth: '1', vectorEffect: 'non-scaling-stroke' };
    const dotStyle = { fill: 'rgba(255,255,255,0.7)', r: '3' };

    switch (gridType) {
      case 'thirds': {
        const x1 = width / 3, x2 = (2 * width) / 3;
        const y1 = height / 3, y2 = (2 * height) / 3;
        return (
          <>
            {/* Vertical lines */}
            <line x1={x1} y1={0} x2={x1} y2={height} {...lineStyle} />
            <line x1={x2} y1={0} x2={x2} y2={height} {...lineStyle} />
            {/* Horizontal lines */}
            <line x1={0} y1={y1} x2={width} y2={y1} {...lineStyle} />
            <line x1={0} y1={y2} x2={width} y2={y2} {...lineStyle} />
            {/* Intersection dots — power points */}
            <circle cx={x1} cy={y1} {...dotStyle} />
            <circle cx={x2} cy={y1} {...dotStyle} />
            <circle cx={x1} cy={y2} {...dotStyle} />
            <circle cx={x2} cy={y2} {...dotStyle} />
          </>
        );
      }
      case 'center': {
        const cx = width / 2, cy = height / 2;
        return (
          <>
            <line x1={cx} y1={0} x2={cx} y2={height} {...lineStyle} />
            <line x1={0} y1={cy} x2={width} y2={cy} {...lineStyle} />
            <circle cx={cx} cy={cy} {...dotStyle} />
          </>
        );
      }
      case 'diagonal':
        return (
          <>
            <line x1={0} y1={0} x2={width} y2={height} {...lineStyle} strokeOpacity="0.4" />
            <line x1={width} y1={0} x2={0} y2={height} {...lineStyle} strokeOpacity="0.4" />
            {/* Center dot */}
            <circle cx={width / 2} cy={height / 2} {...dotStyle} />
          </>
        );
      case 'grid4x4': {
        const lines = [];
        for (let i = 1; i < 4; i++) {
          lines.push(<line key={`v${i}`} x1={(width * i) / 4} y1={0} x2={(width * i) / 4} y2={height} {...lineStyle} strokeOpacity="0.35" />);
          lines.push(<line key={`h${i}`} x1={0} y1={(height * i) / 4} x2={width} y2={(height * i) / 4} {...lineStyle} strokeOpacity="0.35" />);
        }
        return <>{lines}</>;
      }
      case 'golden': {
        // Golden ratio ≈ 0.382 and 0.618
        const gx1 = width * 0.382, gx2 = width * 0.618;
        const gy1 = height * 0.382, gy2 = height * 0.618;
        return (
          <>
            <line x1={gx1} y1={0} x2={gx1} y2={height} {...lineStyle} strokeDasharray="6,4" />
            <line x1={gx2} y1={0} x2={gx2} y2={height} {...lineStyle} strokeDasharray="6,4" />
            <line x1={0} y1={gy1} x2={width} y2={gy1} {...lineStyle} strokeDasharray="6,4" />
            <line x1={0} y1={gy2} x2={width} y2={gy2} {...lineStyle} strokeDasharray="6,4" />
            <circle cx={gx1} cy={gy1} {...dotStyle} />
            <circle cx={gx2} cy={gy1} {...dotStyle} />
            <circle cx={gx1} cy={gy2} {...dotStyle} />
            <circle cx={gx2} cy={gy2} {...dotStyle} />
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <svg
      className="absolute pointer-events-none z-[10]"
      style={{ left: x, top: y, width, height }}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {renderLines()}
    </svg>
  );
};

/* ─── Default aspect ratio presets ───────────────────────────── */

const DEFAULT_PRESETS = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '3:1', value: 3 / 1 },
];

/* ─── File validation ────────────────────────────────────────── */

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const validateFile = (file, maxSize = MAX_FILE_SIZE) => {
  if (!file) return 'No file selected.';
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Unsupported format. Please select JPG, PNG, or WEBP.';
  if (file.size > maxSize) return `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`;
  return null;
};

/**
 * GlobalImageEditor — Professional image editor modal with Rule of Thirds grid,
 * crop, zoom, rotate, straighten, mirror, and Cloudinary upload.
 * Used across the entire admin portal for all image uploads.
 */
const GlobalImageEditor = ({
  isOpen,
  onClose,
  onComplete,
  imageSrc: initialImageSrc = null,
  aspectRatio: defaultAspect = 1,
  aspectPresets = null,
  enableFreeCrop = true,
  enableRotation = true,
  enableFlip = true,
  enableZoom = true,
  maxFileSize = MAX_FILE_SIZE,
  outputQuality = 0.95,
  title = 'Image Editor',
  uploadOnApply = true,
  showFileSelect = true,
}) => {
  const [imageSrc, setImageSrc] = useState(initialImageSrc);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [straighten, setStraighten] = useState(0); // Fine-tune ±45°
  const [aspect, setAspect] = useState(defaultAspect);
  const [flip, setFlip] = useState({ horizontal: false, vertical: false });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropAreaDisplay, setCropAreaDisplay] = useState(null); // For grid overlay positioning
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [gridType, setGridType] = useState('thirds'); // Default: Rule of Thirds ON
  const [showGridMenu, setShowGridMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('crop'); // 'crop' | 'straighten'
  const fileInputRef = useRef(null);
  const cropContainerRef = useRef(null);
  const gridMenuRef = useRef(null);

  // Combined rotation = 90° steps + fine straighten
  const totalRotation = rotation + straighten;

  // Sync imageSrc from parent
  useEffect(() => {
    setImageSrc(initialImageSrc || null);
  }, [initialImageSrc]);

  // Reset editor controls when modal opens
  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setStraighten(0);
      setFlip({ horizontal: false, vertical: false });
      setAspect(defaultAspect);
      setUploading(false);
      setUploadProgress(0);
      setGridType('thirds');
      setActiveTab('crop');
      setShowGridMenu(false);
    }
  }, [isOpen, defaultAspect]);

  // Close grid menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (gridMenuRef.current && !gridMenuRef.current.contains(e.target)) {
        setShowGridMenu(false);
      }
    };
    if (showGridMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showGridMenu]);

  // Prevent body scrolling when editor is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  // Keyboard shortcuts (Escape = Cancel, Enter = Done)
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !uploading) {
        handleCancel();
      } else if (e.key === 'Enter' && !uploading && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        handleApply();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, imageSrc, uploading, croppedAreaPixels, totalRotation, flip]);

  // Build presets
  const presets = aspectPresets || DEFAULT_PRESETS.filter(p => {
    if (p.value === null) return enableFreeCrop;
    return true;
  });

  // Callbacks
  const onCropChange = useCallback((c) => setCrop(c), []);
  const onZoomChange = useCallback((z) => setZoom(z), []);
  const onCropCompleteCallback = useCallback((croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
    setCropAreaDisplay(croppedArea);
  }, []);

  // Update grid overlay position by watching the crop container
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!cropContainerRef.current || !isOpen) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(cropContainerRef.current);
    return () => observer.disconnect();
  }, [isOpen, imageSrc]);

  // Calculate grid overlay position from cropAreaDisplay (percentage-based from react-easy-crop)
  const gridOverlayRect = useMemo(() => {
    if (!cropAreaDisplay || !containerSize.width) return null;
    return {
      x: (cropAreaDisplay.x / 100) * containerSize.width,
      y: (cropAreaDisplay.y / 100) * containerSize.height,
      width: (cropAreaDisplay.width / 100) * containerSize.width,
      height: (cropAreaDisplay.height / 100) * containerSize.height,
    };
  }, [cropAreaDisplay, containerSize]);

  // File select
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateFile(file, maxFileSize);
    if (error) { toast.error(error); return; }
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Reset
  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setStraighten(0);
    setFlip({ horizontal: false, vertical: false });
    setAspect(defaultAspect);
  };

  // Apply & Upload — grid is NEVER included in the final image
  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      setUploading(true);
      setUploadProgress(10);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, totalRotation, flip, outputQuality);
      if (!croppedBlob) {
        toast.error('Failed to generate cropped image. Please try another image.');
        return;
      }
      setUploadProgress(40);

      // Helper to convert blob to permanent Base64 Data URL
      const getBase64DataUrl = (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

      let finalUrl = null;

      if (uploadOnApply) {
        const formData = new FormData();
        formData.append('image', croppedBlob, `edited-${Date.now()}.webp`);
        try {
          const { data } = await api.post('/upload/image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e) => {
              if (e.total) setUploadProgress(40 + Math.round((e.loaded / e.total) * 55));
            },
          });
          setUploadProgress(100);
          if (data?.url) {
            finalUrl = data.url;
          }
        } catch (err) {
          console.warn('[UPLOAD SERVER FALLBACK TO BASE64]', err.message);
        }
      }

      // If server upload did not return a permanent URL, convert croppedBlob to Base64 data URL
      if (!finalUrl) {
        finalUrl = await getBase64DataUrl(croppedBlob);
      }

      if (finalUrl) {
        onComplete(finalUrl, croppedBlob);
        toast.success('Image cropped & saved successfully! ✨');
        onClose();
      } else {
        toast.error('Could not process cropped image. Please try again.');
      }
    } catch (err) {
      console.error('[CROP ERROR]', err);
      toast.error('Unable to edit this image. Please try another image.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Cancel
  const handleCancel = () => {
    setImageSrc(null);
    onClose();
  };

  if (!isOpen) return null;

  const hasImage = !!imageSrc;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col"
        style={{ background: '#0a0a0a' }}
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 shrink-0 border-b border-white/8" style={{ background: '#111' }}>
          <button onClick={handleCancel} disabled={uploading}
            className="text-white/70 hover:text-white text-sm font-semibold transition disabled:opacity-50 px-2 py-1">
            Cancel
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <FiCrop className="text-amber-400 w-4 h-4 shrink-0" />
            <h3 className="font-bold text-white text-sm truncate">{title}</h3>
          </div>
          <button onClick={handleApply} disabled={uploading || !hasImage}
            className="text-amber-400 hover:text-amber-300 text-sm font-bold transition disabled:opacity-50 px-2 py-1 flex items-center gap-1">
            {uploading ? (
              <><FiRefreshCw className="animate-spin" size={13} /> Saving</>
            ) : (
              <><FiCheck size={15} /> Done</>
            )}
          </button>
        </div>

        {/* ─── Main Content ─── */}
        {!hasImage && showFileSelect ? (
          /* ─── File Upload Zone ─── */
          <div className="flex-1 flex items-center justify-center p-6">
            <div
              className="border-2 border-dashed border-white/20 hover:border-amber-400/60 rounded-2xl p-12 sm:p-16 text-center transition-colors cursor-pointer max-w-md w-full"
              style={{ background: 'rgba(255,255,255,0.03)' }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(251,191,36,0.6)'; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const error = validateFile(file, maxFileSize);
                  if (error) { toast.error(error); return; }
                  const reader = new FileReader();
                  reader.onload = () => setImageSrc(reader.result);
                  reader.readAsDataURL(file);
                }
              }}
            >
              <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(',')} onChange={handleFileSelect} className="hidden" />
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-4">
                <FiUploadCloud size={32} />
              </div>
              <p className="font-bold text-white text-sm mb-1">Click or Drag & Drop Image</p>
              <p className="text-xs text-white/40">JPG, PNG, WEBP · Max {Math.round(maxFileSize / 1024 / 1024)}MB</p>
            </div>
          </div>
        ) : hasImage ? (
          <>
            {/* ─── Crop Area (Full Screen Dark) ─── */}
            <div ref={cropContainerRef} className="relative flex-1 min-h-0" style={{ background: '#0a0a0a' }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={totalRotation}
                aspect={aspect}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropCompleteCallback}
                cropShape="rect"
                showGrid={false}
                style={{
                  containerStyle: { background: '#0a0a0a' },
                  cropAreaStyle: {
                    border: '2px solid rgba(255,255,255,0.85)',
                    borderRadius: '2px',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
                  },
                  mediaStyle: {
                    transform: `scaleX(${flip.horizontal ? -1 : 1}) scaleY(${flip.vertical ? -1 : 1})`,
                  },
                }}
              />
              {/* Grid Overlay — pure visual, never saved */}
              <GridOverlay gridType={gridType} cropArea={gridOverlayRect} />
            </div>

            {/* ─── Upload Progress ─── */}
            {uploading && uploadProgress > 0 && (
              <div className="px-4 py-2 shrink-0" style={{ background: '#111' }}>
                <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-[10px] text-white/40 mt-1 text-center">
                  {uploadProgress < 40 ? 'Processing image...' : uploadProgress < 95 ? 'Uploading to cloud...' : 'Finalizing...'}
                </p>
              </div>
            )}

            {/* ─── Bottom Controls Panel ─── */}
            <div className="shrink-0 border-t border-white/8 overflow-y-auto" style={{ background: '#111', maxHeight: '45vh' }}>
              {/* Tab Bar */}
              <div className="flex border-b border-white/8">
                {[
                  { id: 'crop', label: 'Crop', icon: <FiCrop size={14} /> },
                  { id: 'straighten', label: 'Straighten', icon: <FiSliders size={14} /> },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition ${
                      activeTab === tab.id ? 'text-amber-400 border-b-2 border-amber-400' : 'text-white/50 hover:text-white/70'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-3 sm:p-4 space-y-3">
                {activeTab === 'crop' && (
                  <>
                    {/* Aspect Ratio */}
                    <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Aspect Ratio</p>
                      <div className="flex flex-wrap gap-1.5">
                        {presets.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setAspect(p.value)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                              aspect === p.value
                                ? 'bg-amber-400 text-black shadow-sm'
                                : 'bg-white/8 text-white/60 hover:bg-white/15'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Zoom */}
                    {enableZoom && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Zoom</p>
                          <span className="text-[10px] text-white/30 font-mono">{zoom.toFixed(1)}x</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setZoom(z => Math.max(1, z - 0.1))}
                            className="p-2 rounded-lg bg-white/8 text-white/60 hover:bg-white/15 transition shrink-0">
                            <FiZoomOut size={14} />
                          </button>
                          <input type="range" min={1} max={5} step={0.05} value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="flex-1 h-1 bg-white/15 rounded-full appearance-none cursor-pointer accent-amber-500
                              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                              [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
                          />
                          <button type="button" onClick={() => setZoom(z => Math.min(5, z + 0.1))}
                            className="p-2 rounded-lg bg-white/8 text-white/60 hover:bg-white/15 transition shrink-0">
                            <FiZoomIn size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Tool Buttons Row */}
                    <div className="flex flex-wrap gap-1.5">
                      {/* Rotate */}
                      {enableRotation && (
                        <>
                          <button type="button" onClick={() => setRotation(r => r - 90)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/8 text-white/70 text-xs font-bold hover:bg-white/15 transition cursor-pointer"
                            title="Rotate Left 90°" aria-label="Rotate image left">
                            <FiRotateCcw size={13} /> <span className="hidden xs:inline">Left</span>
                          </button>
                          <button type="button" onClick={() => setRotation(r => r + 90)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/8 text-white/70 text-xs font-bold hover:bg-white/15 transition cursor-pointer"
                            title="Rotate Right 90°" aria-label="Rotate image right">
                            <FiRotateCw size={13} /> <span className="hidden xs:inline">Right</span>
                          </button>
                        </>
                      )}

                      {/* Flip */}
                      {enableFlip && (
                        <>
                          <button type="button" onClick={() => setFlip(f => ({ ...f, horizontal: !f.horizontal }))}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                              flip.horizontal ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-white/8 text-white/70 hover:bg-white/15'
                            }`}
                            title="Mirror Horizontal" aria-label="Flip image horizontally">
                            ↔ <span className="hidden sm:inline">Mirror</span>
                          </button>
                          <button type="button" onClick={() => setFlip(f => ({ ...f, vertical: !f.vertical }))}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                              flip.vertical ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-white/8 text-white/70 hover:bg-white/15'
                            }`}
                            title="Mirror Vertical" aria-label="Flip image vertically">
                            ↕ <span className="hidden sm:inline">Flip V</span>
                          </button>
                        </>
                      )}

                      {/* Grid Toggle */}
                      <div className="relative" ref={gridMenuRef}>
                        <button type="button"
                          onClick={() => setShowGridMenu(!showGridMenu)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                            gridType !== 'none'
                              ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                              : 'bg-white/8 text-white/70 hover:bg-white/15'
                          }`}
                          title="Composition Grid" aria-label="Toggle composition grid">
                          <FiGrid size={13} /> <span className="hidden sm:inline">Grid</span>
                        </button>

                        {/* Grid Type Dropdown */}
                        <AnimatePresence>
                          {showGridMenu && (
                            <motion.div
                              initial={{ opacity: 0, y: 8, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 8, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              className="absolute bottom-full mb-2 left-0 sm:left-auto sm:right-0 rounded-xl shadow-2xl border border-white/15 overflow-hidden z-50 min-w-[180px]"
                              style={{ background: '#1a1a1a' }}
                            >
                              <p className="px-3 py-2 text-[9px] font-bold text-white/30 uppercase tracking-widest border-b border-white/8">
                                Composition Guide
                              </p>
                              {GRID_TYPES.map(g => (
                                <button
                                  key={g.id}
                                  onClick={() => { setGridType(g.id); setShowGridMenu(false); }}
                                  className={`w-full text-left px-3 py-2.5 text-xs font-semibold transition flex items-center gap-2.5 ${
                                    gridType === g.id
                                      ? 'text-amber-400 bg-amber-400/10'
                                      : 'text-white/70 hover:bg-white/8'
                                  }`}
                                >
                                  <span className="w-5 text-center text-sm opacity-70">{g.icon || '○'}</span>
                                  {g.label}
                                  {gridType === g.id && <FiCheck size={12} className="ml-auto text-amber-400" />}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Reset */}
                      <button type="button" onClick={handleReset}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/8 text-amber-400 text-xs font-bold hover:bg-white/15 transition cursor-pointer ml-auto"
                        title="Reset all edits" aria-label="Reset all edits">
                        <FiRefreshCw size={13} /> Reset
                      </button>
                    </div>

                    {/* Choose Different Photo */}
                    {showFileSelect && (
                      <button type="button"
                        onClick={() => { setImageSrc(null); fileInputRef.current?.click(); }}
                        className="text-xs text-amber-400/80 font-semibold hover:underline cursor-pointer">
                        ← Choose Different Photo
                      </button>
                    )}
                  </>
                )}

                {activeTab === 'straighten' && (
                  <>
                    {/* Fine Straighten Slider */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Straighten</p>
                        <span className="text-[10px] text-white/30 font-mono">{straighten > 0 ? '+' : ''}{straighten}°</span>
                      </div>
                      <div className="relative">
                        {/* Tick marks */}
                        <div className="flex justify-between px-1 mb-1">
                          {[-45, -30, -15, 0, 15, 30, 45].map(v => (
                            <span key={v} className={`text-[8px] ${v === 0 ? 'text-amber-400 font-bold' : 'text-white/20'}`}>
                              {v}°
                            </span>
                          ))}
                        </div>
                        <input type="range" min={-45} max={45} step={0.5} value={straighten}
                          onChange={(e) => setStraighten(Number(e.target.value))}
                          className="w-full h-1 bg-white/15 rounded-full appearance-none cursor-pointer accent-amber-500
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                            [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
                        />
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button type="button" onClick={() => setStraighten(0)}
                          className="px-3 py-2 rounded-xl bg-white/8 text-white/70 text-xs font-bold hover:bg-white/15 transition flex-1">
                          Reset to 0°
                        </button>
                      </div>
                    </div>

                    {/* Rotation Buttons (90° steps) */}
                    <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Rotate (90° steps)</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setRotation(r => r - 90)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/8 text-white/70 text-xs font-bold hover:bg-white/15 transition"
                          aria-label="Rotate left 90 degrees">
                          <FiRotateCcw size={14} /> Rotate Left
                        </button>
                        <button type="button" onClick={() => setRotation(r => r + 90)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/8 text-white/70 text-xs font-bold hover:bg-white/15 transition"
                          aria-label="Rotate right 90 degrees">
                          <FiRotateCw size={14} /> Rotate Right
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
};

export default GlobalImageEditor;
