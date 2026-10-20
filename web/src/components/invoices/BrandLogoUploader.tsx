import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlertCircle,
  Check
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BrandLogoUploaderProps {
  logoUrl?: string;
  logoPosition?: 'left' | 'center' | 'right';
  logoSize?: 'sm' | 'md' | 'lg' | number;
  onUpdateLogo: (logoUrl: string) => void;
  onUpdatePosition?: (position: 'left' | 'center' | 'right') => void;
  onUpdateSize?: (size: 'sm' | 'md' | 'lg' | number) => void;
  onRemoveLogo: () => void;
  isDark?: boolean;
  compact?: boolean;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

/**
 * Sanitize SVG content:
 * - Strips all <script>...</script> tags
 * - Strips all inline event handlers (onclick, onload, etc.)
 * - Strips javascript: pseudo-protocols
 * - Strips external HTTP/HTTPS resource fetches in image/use tags
 */
export function sanitizeSvg(svgContent: string): string {
  let clean = svgContent;

  // 1. Strip script tags
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');

  // 2. Strip inline event handlers: onclick, onerror, onload, onmouseover, etc.
  clean = clean.replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 3. Strip javascript: URIs in href or xlink:href
  clean = clean.replace(/(?:href|xlink:href)\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*")/gi, '');

  // 4. Strip external references in <image> or <use> tags that point to external domains
  clean = clean.replace(/(?:href|xlink:href)\s*=\s*(?:'https?:[^']*'|"https?:[^"]*")/gi, 'href=""');

  return clean.trim();
}

export function BrandLogoUploader({
  logoUrl,
  logoPosition = 'left',
  logoSize = 'md',
  onUpdateLogo,
  onUpdatePosition,
  onUpdateSize,
  onRemoveLogo,
  isDark = true,
  compact = false,
}: BrandLogoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute numeric height from logoSize
  const currentHeight =
    typeof logoSize === 'number'
      ? logoSize
      : logoSize === 'sm'
      ? 48
      : logoSize === 'lg'
      ? 110
      : 72;

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setIsSuccess(false);

    // 1. Validate File Size (Max 2 MB)
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(`File size (${sizeMB} MB) exceeds the 2 MB limit. Please upload a smaller file.`);
      return;
    }

    // 2. Validate File Type
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isValidMime = ALLOWED_MIME_TYPES.includes(file.type);
    const isValidExt = ALLOWED_EXTENSIONS.includes(ext);

    if (!isValidMime && !isValidExt) {
      setErrorMessage(`Invalid file format. Allowed formats: PNG, JPG, WEBP, SVG (max 2 MB).`);
      return;
    }

    try {
      let dataUrl: string;

      if (file.type === 'image/svg+xml' || ext === '.svg') {
        const text = await file.text();
        const cleanSvg = sanitizeSvg(text);
        if (!cleanSvg.includes('<svg')) {
          setErrorMessage('Invalid SVG file structure.');
          return;
        }
        // Base64 encode the sanitized SVG
        const base64 = btoa(unescape(encodeURIComponent(cleanSvg)));
        dataUrl = `data:image/svg+xml;base64,${base64}`;
      } else {
        // PNG, JPG, WEBP
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      // Persist to localStorage for business profile default
      try {
        localStorage.setItem('user_brand_logo', dataUrl);
      } catch (e) {
        console.warn('Could not save logo to localStorage:', e);
      }

      // Persist to user profile preferences if logged in
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: uData } = await supabase.from('users').select('preferences').eq('id', user.id).maybeSingle();
          const currentPrefs = uData?.preferences || {};
          await supabase.from('users').update({
            preferences: {
              ...currentPrefs,
              brand_logo: dataUrl,
            }
          }).eq('id', user.id);
        }
      } catch (e) {
        console.warn('Could not persist logo to Supabase:', e);
      }

      onUpdateLogo(dataUrl);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setErrorMessage(err.message || 'Failed to process logo file.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    onRemoveLogo();
    try {
      localStorage.removeItem('user_brand_logo');
    } catch (e) {}
    setErrorMessage(null);
  };

  const cardBg = isDark ? 'border-zinc-800 bg-[#12131A]' : 'border-zinc-200 bg-zinc-50/90';
  const labelColor = isDark ? 'text-[#A1A1AA]' : 'text-zinc-600';
  const textPrimary = isDark ? 'text-[#F5F5F5]' : 'text-zinc-900';

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* ── THUMBNAIL PREVIEW IF LOGO IS SET ── */}
      {logoUrl ? (
        <div className={`p-3 rounded-xl border ${cardBg} space-y-3`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${labelColor}`}>
              Active Brand Logo
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                  isDark
                    ? 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                    : 'border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 shadow-2xs'
                }`}
                title="Replace Brand Logo"
              >
                <RefreshCw size={12} className="text-[#FF6B4A]" />
                <span className="text-[10px]">Replace</span>
              </button>

              <button
                type="button"
                onClick={handleRemove}
                className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                  isDark
                    ? 'border-zinc-800 hover:border-red-500/50 hover:bg-red-500/10 text-zinc-400 hover:text-red-400'
                    : 'border-zinc-200 hover:border-red-300 hover:bg-red-50 text-zinc-500 hover:text-red-600'
                }`}
                title="Remove Brand Logo"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Logo Thumbnail Container with Transparency Grid */}
          <div
            className={`w-full h-24 rounded-lg border flex items-center justify-center p-3 relative overflow-hidden ${
              isDark ? 'border-zinc-800 bg-[#090A0F]' : 'border-zinc-200 bg-white'
            }`}
            style={{
              backgroundImage:
                'linear-gradient(45deg, rgba(120,120,120,0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(120,120,120,0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(120,120,120,0.08) 75%), linear-gradient(-45deg, transparent 75%, rgba(120,120,120,0.08) 75%)',
              backgroundSize: '12px 12px',
              backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
            }}
          >
            <img
              src={logoUrl}
              alt="Uploaded Brand Logo"
              className="max-h-full max-w-full object-contain drop-shadow-xs"
            />
          </div>

          {/* Controls: Size Presets & Slider */}
          <div className="space-y-2 pt-1 border-t border-zinc-700/40">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className={labelColor}>Logo Display Height:</span>
              <span className="font-bold text-[#FF6B4A]">{currentHeight}px</span>
            </div>

            {/* Quick Size Presets */}
            <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
              {[
                { label: 'Small', h: 48, id: 'sm' as const },
                { label: 'Medium', h: 72, id: 'md' as const },
                { label: 'Large', h: 110, id: 'lg' as const },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onUpdateSize && onUpdateSize(s.h)}
                  className={`py-1 px-2 rounded-md border text-center transition-all ${
                    currentHeight === s.h
                      ? 'border-[#FF6B4A] bg-[#FF6B4A]/15 text-[#FF6B4A] font-bold ring-1 ring-[#FF6B4A]/30'
                      : isDark
                      ? 'border-zinc-800 bg-[#0A0B10] text-zinc-400 hover:text-zinc-200'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 shadow-2xs'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Height Slider (40px - 160px) */}
            <input
              type="range"
              min="40"
              max="160"
              value={currentHeight}
              onChange={(e) => onUpdateSize && onUpdateSize(parseInt(e.target.value) || 72)}
              className="w-full accent-[#FF6B4A] cursor-pointer"
            />
          </div>

          {/* Controls: Alignment (Left, Center, Right) */}
          {onUpdatePosition && (
            <div className="space-y-1.5 pt-1 border-t border-zinc-700/40">
              <span className={`text-[10px] font-mono uppercase font-bold block ${labelColor}`}>
                Logo Alignment in Header
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                {[
                  { pos: 'left' as const, label: 'Left', icon: AlignLeft },
                  { pos: 'center' as const, label: 'Center', icon: AlignCenter },
                  { pos: 'right' as const, label: 'Right', icon: AlignRight },
                ].map((p) => {
                  const Icon = p.icon;
                  const isSelected = logoPosition === p.pos;
                  return (
                    <button
                      key={p.pos}
                      type="button"
                      onClick={() => onUpdatePosition(p.pos)}
                      className={`py-1.5 px-2 rounded-md border flex items-center justify-center gap-1.5 transition-all ${
                        isSelected
                          ? 'border-[#FF6B4A] bg-[#FF6B4A]/15 text-[#FF6B4A] font-bold ring-1 ring-[#FF6B4A]/30'
                          : isDark
                          ? 'border-zinc-800 bg-[#0A0B10] text-zinc-400 hover:text-zinc-200'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 shadow-2xs'
                      }`}
                    >
                      <Icon size={12} />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── UPLOAD DROP ZONE (NO LOGO SET) ── */
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[#FF6B4A] bg-[#FF6B4A]/10 scale-[1.01]'
              : isDark
              ? 'border-zinc-800 hover:border-zinc-700 bg-[#12131A]/60 hover:bg-[#12131A]'
              : 'border-zinc-300 hover:border-[#FF6B4A]/60 bg-zinc-50/80 hover:bg-zinc-50'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isDark ? 'bg-zinc-800/80 text-[#FF6B4A]' : 'bg-[#FF6B4A]/10 text-[#FF6B4A]'
            }`}>
              <UploadCloud size={20} />
            </div>

            <div>
              <span className={`text-xs font-bold block ${textPrimary}`}>
                Upload Brand Logo
              </span>
              <span className={`text-[11px] block mt-0.5 ${labelColor}`}>
                Drag and drop image here, or <strong className="text-[#FF6B4A] underline font-semibold">browse</strong>
              </span>
            </div>

            <span className={`text-[10px] font-mono block ${labelColor} opacity-80`}>
              PNG, JPG, WEBP, SVG (Max 2 MB)
            </span>
          </div>
        </div>
      )}

      {/* Inline Validation / Success Feedback */}
      {errorMessage && (
        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-xs text-red-400 animate-fadeIn">
          <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isSuccess && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400 animate-fadeIn">
          <Check size={14} className="shrink-0 text-emerald-400" />
          <span>Logo uploaded and saved to business profile!</span>
        </div>
      )}
    </div>
  );
}
