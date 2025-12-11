import React, { useState } from 'react';
import { Sparkles, ShoppingBag, Scissors, Eye, Loader2, Check } from 'lucide-react';
import { StyleItem } from '../types';

interface StyleCardProps {
  item: StyleItem;
  type: 'hair' | 'fashion';
  onTryOn: (item: StyleItem) => void;
  onAction: (item: StyleItem) => void; // Shop or Find Salon
  onGeneratePreview: (item: StyleItem) => Promise<void>;
  onColorChange: (item: StyleItem, color: string) => void;
}

const COLORS = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Yellow', hex: '#F59E0B' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Pink', hex: '#EC4899' },
];

const StyleCard: React.FC<StyleCardProps> = ({ item, type, onTryOn, onAction, onGeneratePreview, onColorChange }) => {
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handlePreviewClick = async () => {
    if (item.thumbnail) {
      onTryOn(item); // If preview exists, clicking it opens full try-on
    } else {
      setIsPreviewLoading(true);
      await onGeneratePreview(item);
      setIsPreviewLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-gray-700 rounded-xl p-4 flex flex-col justify-between hover:border-primary transition-colors duration-300">
      <div className="flex gap-4 mb-3">
        {/* Preview / Thumbnail Icon */}
        <div 
          onClick={handlePreviewClick}
          className="w-20 h-20 flex-shrink-0 bg-dark rounded-lg border border-gray-600 flex items-center justify-center cursor-pointer overflow-hidden relative group"
        >
          {item.thumbnail ? (
            <>
              <img src={item.thumbnail} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                 <Sparkles size={16} className="text-white" />
              </div>
            </>
          ) : (
            isPreviewLoading ? (
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            ) : (
              <div className="text-center p-1">
                {type === 'hair' ? <Scissors size={20} className="mx-auto text-gray-500 mb-1" /> : <Eye size={20} className="mx-auto text-gray-500 mb-1" />}
                <span className="text-[10px] text-gray-400 block leading-tight">Tap for Preview</span>
              </div>
            )
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold text-white mb-1 leading-tight">{item.name}</h3>
          <p className="text-gray-400 text-xs line-clamp-2">{item.description}</p>
        </div>
      </div>
      
      {/* Color Picker for Fashion */}
      {type === 'fashion' && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Select Color</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => onColorChange(item, c.name)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${item.selectedColor === c.name ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              >
                {item.selectedColor === c.name && c.name === 'White' && <Check size={12} className="text-black mx-auto" />}
                {item.selectedColor === c.name && c.name !== 'White' && <Check size={12} className="text-white mx-auto" />}
              </button>
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
};

export default StyleCard;