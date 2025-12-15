import React, { useState, useRef } from 'react';
import { Sparkles, ShoppingBag, Scissors, Eye, Loader2, Check, Palette } from 'lucide-react';
import { StyleItem } from '../types';

interface StyleCardProps {
  item: StyleItem;
  type: 'hair' | 'fashion';
  onTryOn?: (item: StyleItem) => void;
  onAction?: (item: StyleItem) => void; // Shop or Find Salon
  onGeneratePreview?: (item: StyleItem) => Promise<void>;
  onColorChange: (item: StyleItem, color: string) => void;
  // New props for selection mode
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (item: StyleItem) => void;
}

const PRESET_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'Dark Brown', hex: '#3E2723' },
  { name: 'Brown', hex: '#795548' },
  { name: 'Blonde', hex: '#FFD54F' },
  { name: 'Red', hex: '#D32F2F' },
  { name: 'Auburn', hex: '#A52A2A' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Blue', hex: '#1976D2' },
  { name: 'Pink', hex: '#E91E63' },
  { name: 'Purple', hex: '#7B1FA2' },
  { name: 'Green', hex: '#388E3C' },
];

const StyleCard: React.FC<StyleCardProps> = ({ 
  item, type, onTryOn, onAction, onGeneratePreview, onColorChange,
  isSelectable = false, isSelected = false, onSelect 
}) => {
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handlePreviewClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelectable && onSelect) {
      onSelect(item);
      return;
    }

    if (item.thumbnail && onTryOn) {
      onTryOn(item);
    } else if (onGeneratePreview) {
      setIsPreviewLoading(true);
      await onGeneratePreview(item);
      setIsPreviewLoading(false);
    }
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onColorChange(item, e.target.value);
  };

  return (
    <div 
      onClick={() => isSelectable && onSelect && onSelect(item)}
      className={`bg-surface border rounded-xl p-4 flex flex-col justify-between transition-all duration-300 relative
        ${isSelectable ? 'cursor-pointer' : ''}
        ${isSelected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-gray-700 hover:border-gray-500'}
      `}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 z-10 bg-primary text-white rounded-full p-1 shadow-lg">
          <Check size={16} strokeWidth={3} />
        </div>
      )}

      <div className="flex gap-4 mb-3">
        {/* Preview / Thumbnail Icon */}
        <div 
          onClick={handlePreviewClick}
          className="w-20 h-20 flex-shrink-0 bg-dark rounded-lg border border-gray-600 flex items-center justify-center cursor-pointer overflow-hidden relative group"
        >
          {item.thumbnail ? (
            <>
              <img src={item.thumbnail} alt="Preview" className="w-full h-full object-cover" />
              {!isSelectable && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                   <Sparkles size={16} className="text-white" />
                </div>
              )}
            </>
          ) : (
            isPreviewLoading ? (
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            ) : (
              <div className="text-center p-1">
                {type === 'hair' ? <Scissors size={20} className="mx-auto text-gray-500 mb-1" /> : <Eye size={20} className="mx-auto text-gray-500 mb-1" />}
                {!isSelectable && <span className="text-[10px] text-gray-400 block leading-tight">Tap for Preview</span>}
              </div>
            )
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold text-white mb-1 leading-tight">{item.name}</h3>
          <p className="text-gray-400 text-xs line-clamp-2">{item.description}</p>
        </div>
      </div>
      
      {/* Color Picker */}
      <div className="mb-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider flex justify-between items-center">
            {type === 'hair' ? 'Hair Color' : 'Fabric Color'}
            <span className="text-[10px] text-gray-600">{item.selectedColor || 'Default'}</span>
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          {PRESET_COLORS.slice(0, 8).map((c) => (
            <button
              key={c.name}
              onClick={() => onColorChange(item, c.name)}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${item.selectedColor === c.name ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}
              style={{ backgroundColor: c.hex }}
              title={c.name}
            >
              {item.selectedColor === c.name && (c.name === 'White' || c.name === 'Silver' || c.name === 'Blonde') && <Check size={12} className="text-black mx-auto" />}
              {item.selectedColor === c.name && !(c.name === 'White' || c.name === 'Silver' || c.name === 'Blonde') && <Check size={12} className="text-white mx-auto" />}
            </button>
          ))}
          
           {/* Custom Color Picker */}
           <div className="relative">
            <button 
                onClick={() => colorInputRef.current?.click()}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-gradient-to-br from-red-500 via-green-500 to-blue-500 hover:scale-110 transition-transform ${item.selectedColor && item.selectedColor.startsWith('#') ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}
                title="Custom Color"
            >
                {item.selectedColor && item.selectedColor.startsWith('#') && <Check size={12} className="text-white drop-shadow-md" />}
                {(!item.selectedColor || !item.selectedColor.startsWith('#')) && <Palette size={12} className="text-white" />}
            </button>
            <input 
                ref={colorInputRef}
                type="color" 
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
                onChange={handleCustomColorChange}
            />
          </div>
        </div>
      </div>

      {!isSelectable && onTryOn && onAction && (
        <div className="flex gap-2 mt-auto">
          <button 
            onClick={() => onTryOn(item)}
            className="flex-1 bg-primary/20 hover:bg-primary/40 text-primary border border-primary/50 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles size={16} />
            Full Try On
          </button>
          <button 
            onClick={() => onAction(item)}
            className="flex-1 bg-secondary/20 hover:bg-secondary/40 text-secondary border border-secondary/50 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
          >
            {type === 'hair' ? <Scissors size={16} /> : <ShoppingBag size={16} />}
            {type === 'hair' ? 'Salons' : 'Shop'}
          </button>
        </div>
      )}
    </div>
  );
};

export default StyleCard;