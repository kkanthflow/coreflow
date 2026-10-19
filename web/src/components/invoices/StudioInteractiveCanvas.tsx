import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { Edit3 } from 'lucide-react';
import type {
  AlignmentGuide,
  CanvasElement,
  InvoiceStudioDocV2,
  StudioDesignProperties,
  StudioLineItem,
} from '../../types/invoiceStudio';
import { CanvasElementRenderer } from './CanvasElementRenderer';
import { CanvasTransformBox } from './CanvasTransformBox';

interface StudioInteractiveCanvasProps {
  document: InvoiceStudioDocV2;
  properties: StudioDesignProperties;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<CanvasElement>, recordHistory?: boolean) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  zoom: number;
  previewMode: boolean;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  seller: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
  };
  client: {
    name: string;
    companyName?: string;
    email?: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
  } | null;
  items: StudioLineItem[];
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  totalAmount: number;
}

export const StudioInteractiveCanvas = forwardRef<HTMLDivElement, StudioInteractiveCanvasProps>(
  (
    {
      document,
      properties,
      selectedElementId,
      onSelectElement,
      onUpdateElement,
      onDeleteElement,
      onDuplicateElement,
      zoom,
      previewMode,
      invoiceNumber,
      issueDate,
      dueDate,
      currency,
      seller,
      client,
      items,
      subtotal,
      totalTax,
      totalDiscount,
      totalAmount,
    },
    ref
  ) => {
    const canvasContainerRef = useRef<HTMLDivElement | null>(null);
    const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
    const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);

    // Drag interaction tracking state
    const dragActionRef = useRef<{
      type: 'move' | 'resize' | 'rotate';
      elementId: string;
      startX: number;
      startY: number;
      initialElement: CanvasElement;
      handle?: string;
      canvasRect: DOMRect;
    } | null>(null);

    // ── KEYBOARD SHORTCUTS (Delete, Duplicate, Nudge, Escape) ──
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!selectedElementId || previewMode) return;

        // If target is an input or textarea, let user type
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
          return;
        }

        const selected = document.elements.find((el) => el.id === selectedElementId);
        if (!selected) return;

        // Delete
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (!selected.isLocked) {
            e.preventDefault();
            onDeleteElement(selectedElementId);
          }
          return;
        }

        // Duplicate (Ctrl+D / Cmd+D)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          onDuplicateElement(selectedElementId);
          return;
        }

        // Deselect (Escape)
        if (e.key === 'Escape') {
          e.preventDefault();
          onSelectElement(null);
          return;
        }

        // Arrow Key Nudges
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          if (selected.isLocked) return;
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;

          onUpdateElement(selectedElementId, {
            x: Math.max(0, Math.min(document.canvas.width - selected.width, selected.x + dx)),
            y: Math.max(0, Math.min(document.canvas.height - selected.height, selected.y + dy)),
          }, true);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedElementId, document.elements, previewMode, onUpdateElement, onDeleteElement, onDuplicateElement, onSelectElement]);

    // ── START MOVE ──
    const handleStartMove = (e: React.PointerEvent, element: CanvasElement) => {
      if (previewMode || element.isLocked) return;
      e.stopPropagation();

      onSelectElement(element.id);

      if (!canvasContainerRef.current) return;
      const rect = canvasContainerRef.current.getBoundingClientRect();

      dragActionRef.current = {
        type: 'move',
        elementId: element.id,
        startX: e.clientX,
        startY: e.clientY,
        initialElement: { ...element },
        canvasRect: rect,
      };

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    // ── START RESIZE ──
    const handleStartResize = (e: React.PointerEvent, element: CanvasElement, handle: string) => {
      if (previewMode || element.isLocked) return;
      e.stopPropagation();

      if (!canvasContainerRef.current) return;
      const rect = canvasContainerRef.current.getBoundingClientRect();

      dragActionRef.current = {
        type: 'resize',
        elementId: element.id,
        startX: e.clientX,
        startY: e.clientY,
        initialElement: { ...element },
        handle,
        canvasRect: rect,
      };

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    // ── START ROTATE ──
    const handleStartRotate = (e: React.PointerEvent, element: CanvasElement) => {
      if (previewMode || element.isLocked) return;
      e.stopPropagation();

      if (!canvasContainerRef.current) return;
      const rect = canvasContainerRef.current.getBoundingClientRect();

      dragActionRef.current = {
        type: 'rotate',
        elementId: element.id,
        startX: e.clientX,
        startY: e.clientY,
        initialElement: { ...element },
        canvasRect: rect,
      };

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    // ── POINTER MOVE (Calculate Drag / Resize / Rotate with Snapping Guides) ──
    const handlePointerMove = (e: React.PointerEvent) => {
      if (!dragActionRef.current) return;
      e.preventDefault();

      const action = dragActionRef.current;
      const scale = zoom / 100;
      const deltaX = (e.clientX - action.startX) / scale;
      const deltaY = (e.clientY - action.startY) / scale;
      const initial = action.initialElement;

      // 1. ROTATION
      if (action.type === 'rotate') {
        const centerCanvasX = (initial.x + initial.width / 2) * scale + action.canvasRect.left;
        const centerCanvasY = (initial.y + initial.height / 2) * scale + action.canvasRect.top;

        const radians = Math.atan2(e.clientY - centerCanvasY, e.clientX - centerCanvasX);
        let degrees = Math.round((radians * 180) / Math.PI) + 90;

        // Snap to right angles
        if (Math.abs(degrees % 90) < 4 || Math.abs(degrees % 90) > 86) {
          degrees = Math.round(degrees / 90) * 90;
        }

        onUpdateElement(action.elementId, { rotation: degrees }, false);
        return;
      }

      // 2. RESIZE
      if (action.type === 'resize' && action.handle) {
        let newX = initial.x;
        let newY = initial.y;
        let newW = initial.width;
        let newH = initial.height;
        const minW = 40;
        const minH = 24;

        if (action.handle.includes('e')) newW = Math.max(minW, initial.width + deltaX);
        if (action.handle.includes('s')) newH = Math.max(minH, initial.height + deltaY);
        if (action.handle.includes('w')) {
          const possibleW = initial.width - deltaX;
          if (possibleW >= minW) {
            newW = possibleW;
            newX = initial.x + deltaX;
          }
        }
        if (action.handle.includes('n')) {
          const possibleH = initial.height - deltaY;
          if (possibleH >= minH) {
            newH = possibleH;
            newY = initial.y + deltaY;
          }
        }

        onUpdateElement(action.elementId, {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        }, false);
        return;
      }

      // 3. MOVE (WITH MAGNETIC SNAPPING GUIDES)
      if (action.type === 'move') {
        let targetX = initial.x + deltaX;
        let targetY = initial.y + deltaY;

        const snapTolerance = 6;
        const guides: AlignmentGuide[] = [];

        // Canvas Boundaries & Center Snaps
        const canvasW = document.canvas.width;
        const canvasH = document.canvas.height;
        const canvasCenterX = canvasW / 2;
        const canvasCenterY = canvasH / 2;

        // Snap X Center
        const currentCenterX = targetX + initial.width / 2;
        if (Math.abs(currentCenterX - canvasCenterX) <= snapTolerance) {
          targetX = canvasCenterX - initial.width / 2;
          guides.push({
            type: 'vertical',
            position: canvasCenterX,
            start: 0,
            end: canvasH,
          });
        }

        // Snap Y Center
        const currentCenterY = targetY + initial.height / 2;
        if (Math.abs(currentCenterY - canvasCenterY) <= snapTolerance) {
          targetY = canvasCenterY - initial.height / 2;
          guides.push({
            type: 'horizontal',
            position: canvasCenterY,
            start: 0,
            end: canvasW,
          });
        }

        // Snap Margins (Left: 48, Right: canvasW - 48)
        if (Math.abs(targetX - 48) <= snapTolerance) {
          targetX = 48;
          guides.push({ type: 'vertical', position: 48, start: 0, end: canvasH });
        }
        if (Math.abs(targetX + initial.width - (canvasW - 48)) <= snapTolerance) {
          targetX = canvasW - 48 - initial.width;
          guides.push({ type: 'vertical', position: canvasW - 48, start: 0, end: canvasH });
        }

        // Snap with other elements
        document.elements.forEach((other) => {
          if (other.id === action.elementId || !other.isVisible) return;

          // X alignment
          if (Math.abs(targetX - other.x) <= snapTolerance) {
            targetX = other.x;
            guides.push({
              type: 'vertical',
              position: other.x,
              start: Math.min(targetY, other.y),
              end: Math.max(targetY + initial.height, other.y + other.height),
            });
          }
          // Y alignment
          if (Math.abs(targetY - other.y) <= snapTolerance) {
            targetY = other.y;
            guides.push({
              type: 'horizontal',
              position: other.y,
              start: Math.min(targetX, other.x),
              end: Math.max(targetX + initial.width, other.x + other.width),
            });
          }
        });

        setActiveGuides(guides);

        onUpdateElement(action.elementId, {
          x: Math.round(Math.max(0, Math.min(canvasW - initial.width, targetX))),
          y: Math.round(Math.max(0, Math.min(canvasH - initial.height, targetY))),
        }, false);
      }
    };

    // ── POINTER UP (Commit to History) ──
    const handlePointerUp = (e: React.PointerEvent) => {
      if (!dragActionRef.current) return;
      const action = dragActionRef.current;
      dragActionRef.current = null;
      setActiveGuides([]);

      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }

      // Record final state to history
      const currentElement = document.elements.find((el) => el.id === action.elementId);
      if (currentElement) {
        onUpdateElement(action.elementId, { ...currentElement }, true);
      }
    };

    const isDark = properties.printTheme === 'dark';
    const bgClass = isDark ? 'bg-[#090A0F] text-zinc-100' : 'bg-white text-zinc-900';

    return (
      <div
        ref={(node) => {
          canvasContainerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        id="auvryn-invoice-canvas"
        onPointerDown={(e) => {
          // Deselect when clicking on blank canvas
          if (e.target === canvasContainerRef.current) {
            onSelectElement(null);
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`relative shadow-2xl transition-all duration-150 select-none ${bgClass}`}
        style={{
          width: `${document.canvas.width}px`,
          minHeight: `${document.canvas.height}px`,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* ── SNAPPING ALIGNMENT GUIDELINES OVERLAY ── */}
        {activeGuides.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-[10000]">
            {activeGuides.map((g, idx) =>
              g.type === 'vertical' ? (
                <line
                  key={`v_${idx}`}
                  x1={g.position}
                  y1={g.start}
                  x2={g.position}
                  y2={g.end}
                  stroke="#FF6B4A"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              ) : (
                <line
                  key={`h_${idx}`}
                  x1={g.start}
                  y1={g.position}
                  x2={g.end}
                  y2={g.position}
                  stroke="#FF6B4A"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              )
            )}
          </svg>
        )}

        {/* ── CANVAS ELEMENTS LIST (SORTED BY Z-INDEX) ── */}
        {[...document.elements]
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((element) => {
            if (!element.isVisible) return null;

            const isSelected = selectedElementId === element.id;
            const isHovered = hoveredElementId === element.id;

            return (
              <div
                key={element.id}
                onPointerDown={(e) => handleStartMove(e, element)}
                onMouseEnter={() => setHoveredElementId(element.id)}
                onMouseLeave={() => setHoveredElementId(null)}
                className={`absolute transition-shadow duration-75 group ${
                  previewMode ? 'pointer-events-none' : 'cursor-move'
                } ${
                  isHovered && !isSelected && !previewMode
                    ? 'ring-1 ring-[#FF6B4A]/50 ring-dashed'
                    : ''
                }`}
                style={{
                  left: `${element.x}px`,
                  top: `${element.y}px`,
                  width: `${element.width}px`,
                  height: `${element.height}px`,
                  transform: `rotate(${element.rotation}deg)`,
                  zIndex: isSelected ? 999 : element.zIndex,
                  opacity: element.opacity,
                }}
              >
                {/* Visual Content */}
                <CanvasElementRenderer
                  element={element}
                  properties={properties}
                  invoiceNumber={invoiceNumber}
                  issueDate={issueDate}
                  dueDate={dueDate}
                  currency={currency}
                  seller={seller}
                  client={client}
                  items={items}
                  subtotal={subtotal}
                  totalTax={totalTax}
                  totalDiscount={totalDiscount}
                  totalAmount={totalAmount}
                />

                {/* ── VISIBLE EDITABLE INDICATOR BADGE ── */}
                {!previewMode && (isHovered || isSelected) && (
                  <div
                    className={`absolute -top-7 left-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 shadow-md pointer-events-none z-[10001] transition-all whitespace-nowrap select-none ${
                      isSelected
                        ? 'bg-[#FF6B4A] text-white ring-1 ring-white/30'
                        : 'bg-zinc-900/90 text-zinc-100 border border-zinc-700/80 backdrop-blur-xs'
                    }`}
                  >
                    <Edit3 size={10} className={isSelected ? 'text-white' : 'text-[#FF6B4A]'} />
                    <span>{element.name || 'Editable Element'}</span>
                    <span className="text-[9px] opacity-80 font-normal">
                      · {isSelected ? 'Editing in Panel' : 'Click to edit'}
                    </span>
                  </div>
                )}

                {/* Transform Box with 8 Resize Handles + Rotation Handle */}
                {!previewMode && (
                  <CanvasTransformBox
                    element={element}
                    isSelected={isSelected}
                    zoom={zoom}
                    onStartResize={(e, handle) => handleStartResize(e, element, handle)}
                    onStartRotate={(e) => handleStartRotate(e, element)}
                  />
                )}
              </div>
            );
          })}
      </div>
    );
  }
);
