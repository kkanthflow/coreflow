import type { PointerEvent } from 'react';
import { Lock, RotateCw } from 'lucide-react';
import type { CanvasElement } from '../../types/invoiceStudio';

interface CanvasTransformBoxProps {
  element: CanvasElement;
  isSelected: boolean;
  zoom: number;
  onStartResize: (e: PointerEvent, handle: string) => void;
  onStartRotate: (e: PointerEvent) => void;
}

export function CanvasTransformBox({
  element,
  isSelected,
  zoom,
  onStartResize,
  onStartRotate,
}: CanvasTransformBoxProps) {
  if (!isSelected) return null;

  const handleSize = Math.max(8, Math.min(12, 10 / (zoom / 100)));

  return (
    <div
      className="absolute inset-0 pointer-events-none border-2 border-[#FF6B4A] rounded-[2px]"
      style={{
        zIndex: 9999,
      }}
    >
      {element.isLocked ? (
        <div className="absolute top-1 right-1 p-1 rounded bg-[#FF6B4A] text-white shadow pointer-events-auto">
          <Lock size={12} />
        </div>
      ) : (
        <>
          {/* ── ROTATION HANDLE ── */}
          <div
            className="absolute left-1/2 -top-6 -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-grab active:cursor-grabbing group"
            onPointerDown={onStartRotate}
            title="Drag to rotate element"
          >
            <div
              className="rounded-full bg-white border-2 border-[#FF6B4A] shadow flex items-center justify-center text-[#FF6B4A] hover:bg-[#FF6B4A] hover:text-white transition-colors"
              style={{ width: `${handleSize + 6}px`, height: `${handleSize + 6}px` }}
            >
              <RotateCw size={handleSize} />
            </div>
            <div className="w-[1.5px] h-3 bg-[#FF6B4A]" />
          </div>

          {/* ── 8 RESIZE HANDLES ── */}
          {/* NW */}
          <div
            className="absolute -top-1.5 -left-1.5 bg-white border-2 border-[#FF6B4A] rounded-sm pointer-events-auto cursor-nwse-resize shadow"
            style={{ width: `${handleSize}px`, height: `${handleSize}px` }}
            onPointerDown={(e) => onStartResize(e, 'nw')}
          />
          {/* N */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-white border-2 border-[#FF6B4A] rounded-sm pointer-events-auto cursor-ns-resize shadow"
            style={{ width: `${handleSize}px`, height: `${handleSize}px` }}
            onPointerDown={(e) => onStartResize(e, 'n')}
          />
          {/* NE */}
          <div
            className="absolute -top-1.5 -right-1.5 bg-white border-2 border-[#FF6B4A] rounded-sm pointer-events-auto cursor-nesw-resize shadow"
            style={{ width: `${handleSize}px`, height: `${handleSize}px` }}
            onPointerDown={(e) => onStartResize(e, 'ne')}
          />
          {/* E */}
          <div
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 bg-white border-2 border-[#FF6B4A] rounded-sm pointer-events-auto cursor-ew-resize shadow"
            style={{ width: `${handleSize}px`, height: `${handleSize}px` }}
            onPointerDown={(e) => onStartResize(e, 'e')}
          />
          {/* SE */}
          <div
            className="absolute -bottom-1.5 -right-1.5 bg-white border-2 border-[#FF6B4A] rounded-sm pointer-events-auto cursor-nwse-resize shadow"
            style={{ width: `${handleSize}px`, height: `${handleSize}px` }}
            onPointerDown={(e) => onStartResize(e, 'se')}
          />
          {/* S */}
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-white border-2 border-[#FF6B4A] rounded-sm pointer-events-auto cursor-ns-resize shadow"
            style={{ width: `${handleSize}px`, height: `${handleSize}px` }}
            onPointerDown={(e) => onStartResize(e, 's')}
          />
          {/* SW */}
          <div
            className="absolute -bottom-1.5 -left-1.5 bg-white border-2 border-[#FF6B4A] rounded-sm pointer-events-auto cursor-nesw-resize shadow"
            style={{ width: `${handleSize}px`, height: `${handleSize}px` }}
            onPointerDown={(e) => onStartResize(e, 'sw')}
          />
          {/* W */}
          <div
            className="absolute top-1/2 -left-1.5 -translate-y-1/2 bg-white border-2 border-[#FF6B4A] rounded-sm pointer-events-auto cursor-ew-resize shadow"
            style={{ width: `${handleSize}px`, height: `${handleSize}px` }}
            onPointerDown={(e) => onStartResize(e, 'w')}
          />
        </>
      )}
    </div>
  );
}
