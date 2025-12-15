import React, { useState, useEffect } from 'react';
import { Upload, Scissors, Shirt, MapPin, RefreshCcw, Sparkles, ExternalLink, ChevronRight, AlertCircle, X, ShoppingBag, Search, Link as LinkIcon, Share2, Download, Layers, ArrowLeft, ArrowRight, Heart, Bookmark, Grid, Trash2, Crown, Zap, Calendar, Infinity as InfinityIcon, CheckCircle2, Filter } from 'lucide-react';
import { analyzeImageAndSuggestStyles, visualizeStyle, findNearbySalons, findShoppingLinks, getOutfitDescriptionFromUrl } from './services/geminiService';
import { AnalysisResult, StyleItem, GroundingChunk, Coordinates, HistoryItem, UserUsage, SubscriptionTier } from './types';
import LoadingOverlay from './components/LoadingOverlay';
import StyleCard from './components/StyleCard';

enum AppState {
  UPLOAD,
  ANALYZING,
  DASHBOARD,
  GENERATING_IMAGE,
  SHOWING_RESULT,
  COLLECTION
}

const HAIR_COLOR_FILTERS = [
  { name: 'Black', hex: '#000000' },
  { name: 'Dark Brown', hex: '#3E2723' },
  { name: 'Brown', hex: '#795548' },
  { name: 'Blonde', hex: '#FFD54F' },
  { name: 'Red', hex: '#D32F2F' },
  { name: 'Auburn', hex: '#A52A2A' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'White', hex: '#FFFFFF' },
];

const App: React.FC = () => {
  // State
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  
  // Tabs: hair, fashion, mix
  const [activeTab, setActiveTab] = useState<'hair' | 'fashion' | 'mix'>('hair');
  const [activeColorFilter, setActiveColorFilter] = useState<string | null>(null);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);

  // Collection State
  const [savedItems, setSavedItems] = useState<HistoryItem[]>([]);
  const [resultSource, setResultSource] = useState<'history' | 'collection'>('history');
  const [currentCollectionIndex, setCurrentCollectionIndex] = useState<number>(-1);

  // Usage & Subscription State
  const [usage, setUsage] = useState<UserUsage>({
    installDate: Date.now(),
    lastUsedDate: new Date().toDateString(),
    dailyCount: 0,
    extraDailyLimit: 0,
    tier: 'free'
  });
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [customQuery, setCustomQuery] = useState<string>("");
  const [searchMode, setSearchMode] = useState<'text' | 'link'>('text');
  
  // Mix Selection State
  const [mixSelection, setMixSelection] = useState<{hair: StyleItem | null, outfit: StyleItem | null}>({ hair: null, outfit: null });

  // Grounding Results (Salons or Shopping)
  const [groundingResults, setGroundingResults] = useState<{text: string, chunks: GroundingChunk[]} | null>(null);
  const [showGroundingModal, setShowGroundingModal] = useState(false);
  const [selectedStyleForAction, setSelectedStyleForAction] = useState<StyleItem | null>(null);
  
  // Location
  const [location, setLocation] = useState<Coordinates | null>(null);

  useEffect(() => {
    // Get location on mount for "Nearby" features
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => console.error("Error getting location", error)
      );
    }

    // Load saved collection from localStorage
    const saved = localStorage.getItem('styleGenie_collection');
    if (saved) {
      try {
        setSavedItems(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved collection", e);
      }
    }

    // Load Usage Data
    const savedUsage = localStorage.getItem('styleGenie_usage');
    if (savedUsage) {
      try {
        const parsed: UserUsage = JSON.parse(savedUsage);
        const today = new Date().toDateString();
        
        // Reset count if new day
        if (parsed.lastUsedDate !== today) {
          setUsage({
            ...parsed,
            lastUsedDate: today,
            dailyCount: 0,
            extraDailyLimit: 0 // Reset daily top-ups
          });
        } else {
          setUsage(parsed);
        }
      } catch (e) {
        console.error("Failed to parse usage", e);
      }
    } else {
      // First time user
      const initialUsage: UserUsage = {
        installDate: Date.now(),
        lastUsedDate: new Date().toDateString(),
        dailyCount: 0,
        extraDailyLimit: 0,
        tier: 'free'
      };
      setUsage(initialUsage);
      localStorage.setItem('styleGenie_usage', JSON.stringify(initialUsage));
    }
  }, []);

  // Save collection to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('styleGenie_collection', JSON.stringify(savedItems));
  }, [savedItems]);

  // Save usage to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('styleGenie_usage', JSON.stringify(usage));
  }, [usage]);

  // --- Subscription Logic ---

  const getDailyLimit = () => {
    switch (usage.tier) {
      case 'lifetime': return 150;
      case 'yearly': return 50;
      case 'monthly': return 20;
      case 'free':
      default:
        // Check if within 30 days
        const daysSinceInstall = (Date.now() - usage.installDate) / (1000 * 60 * 60 * 24);
        if (daysSinceInstall > 30) return 0; // Expired
        return 10;
    }
  };

  const checkUsageAndProceed = (action: () => Promise<void>) => {
    const baseLimit = getDailyLimit();
    const totalLimit = baseLimit + usage.extraDailyLimit;

    if (usage.dailyCount >= totalLimit) {
      setShowSubscriptionModal(true);
    } else {
      action();
    }
  };

  const incrementUsage = () => {
    setUsage(prev => ({ ...prev, dailyCount: prev.dailyCount + 1 }));
  };

  const handlePurchase = (option: 'day_pass' | SubscriptionTier, cost: number) => {
    // Simulate Payment Process
    const confirm = window.confirm(`Proceed to pay ₹${cost} for this plan?`);
    if (confirm) {
      setLoadingMessage("Processing Payment...");
      // Simulate API delay
      setTimeout(() => {
        setLoadingMessage("");
        if (option === 'day_pass') {
          setUsage(prev => ({ ...prev, extraDailyLimit: prev.extraDailyLimit + 10 }));
          alert("Payment Successful! 10 extra styles added for today.");
        } else {
          setUsage(prev => ({ ...prev, tier: option as SubscriptionTier }));
          alert(`Payment Successful! You are now on the ${option} plan.`);
        }
        setShowSubscriptionModal(false);
      }, 1500);
    }
  };

  // --- End Subscription Logic ---

  // Handlers
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setUserImage(base64);
        processAnalysis(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const processAnalysis = async (base64Full: string) => {
    try {
      setAppState(AppState.ANALYZING);
      setLoadingMessage("Analyzing your features to find the perfect styles...");
      
      const base64Data = base64Full.split(',')[1];
      const result = await analyzeImageAndSuggestStyles(base64Data, 'initial');
      setAnalysis(result);
      setAppState(AppState.DASHBOARD);
    } catch (error) {
      console.error(error);
      alert("Failed to analyze image. Please try again.");
      setAppState(AppState.UPLOAD);
    }
  };

  const handleColorFilterChange = (color: string | null) => {
    setActiveColorFilter(color);
    if (!analysis) return;
    
    setAnalysis(prev => {
        if (!prev) return null;
        const newHairStyles = prev.hairStyles.map(style => ({
            ...style,
            selectedColor: color || undefined
        }));
        
        return {
            ...prev,
            hairStyles: newHairStyles
        };
    });
  };

  const handleRequestMore = async () => {
    if (!userImage || !analysis) return;
    try {
      setLoadingMessage("Consulting the AI stylist for more ideas...");
      setAppState(AppState.ANALYZING); 
      const base64Data = userImage.split(',')[1];
      
      // If we are in Mix tab, let's load more for both
      if (activeTab === 'mix') {
         const hairResult = await analyzeImageAndSuggestStyles(base64Data, 'more_hair');
         const fashionResult = await analyzeImageAndSuggestStyles(base64Data, 'more_fashion');
         setAnalysis(prev => {
            if (!prev) return null;
            return {
                ...prev,
                hairStyles: [...prev.hairStyles, ...hairResult.hairStyles],
                outfits: [...prev.outfits, ...fashionResult.outfits]
            };
         });
      } else {
        const requestType = activeTab === 'hair' ? 'more_hair' : 'more_fashion';
        const newResult = await analyzeImageAndSuggestStyles(base64Data, requestType);
        
        // Apply active color filter if applicable
        if (requestType === 'more_hair' && activeColorFilter) {
            newResult.hairStyles = newResult.hairStyles.map(s => ({ ...s, selectedColor: activeColorFilter }));
        }

        setAnalysis(prev => {
            if (!prev) return newResult;
            return {
            ...prev,
            hairStyles: requestType === 'more_hair' ? [...prev.hairStyles, ...newResult.hairStyles] : prev.hairStyles,
            outfits: requestType === 'more_fashion' ? [...prev.outfits, ...newResult.outfits] : prev.outfits 
            };
        });
      }
      
      setAppState(AppState.DASHBOARD);
    } catch (e) {
      console.error(e);
      alert("Could not load more styles.");
      setAppState(AppState.DASHBOARD);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userImage || !customQuery.trim()) return;

    if (activeTab === 'fashion' && searchMode === 'link') {
      await handleLinkTryOn();
    } else {
      await handleCustomSearch();
    }
  };

  const handleCustomSearch = async () => {
    try {
      setLoadingMessage(`Looking for "${customQuery}" styles...`);
      setAppState(AppState.ANALYZING);
      const base64Data = userImage!.split(',')[1];

      const result = await analyzeImageAndSuggestStyles(base64Data, 'custom', customQuery);
      
      // Apply active color filter if searching in hair context
      if (activeTab === 'hair' && activeColorFilter) {
         result.hairStyles = result.hairStyles.map(s => ({ ...s, selectedColor: activeColorFilter }));
      }

      setAnalysis(result);
      setCustomQuery(""); 
      setAppState(AppState.DASHBOARD);
    } catch (e) {
      console.error(e);
      alert("Search failed. Please try again.");
      setAppState(AppState.DASHBOARD);
    }
  };

  const handleLinkTryOn = async () => {
    // Gatekeep
    checkUsageAndProceed(async () => {
      try {
        setLoadingMessage("Analyzing product link...");
        setAppState(AppState.ANALYZING);

        const description = await getOutfitDescriptionFromUrl(customQuery);
        
        setLoadingMessage("Trying on the item from the link...");
        const base64Data = userImage!.split(',')[1];
        const genImg = await visualizeStyle(base64Data, description, 'fashion');

        const newItem: HistoryItem = {
          id: Date.now().toString(),
          image: genImg,
          styleName: "Linked Outfit",
          description: description,
          type: 'fashion',
          items: [{ name: "Linked Outfit", description: description }],
          timestamp: Date.now()
        };
        addToHistory(newItem);
        incrementUsage(); // Deduct credit

        setCustomQuery("");
        setResultSource('history');
        setAppState(AppState.SHOWING_RESULT);
      } catch (error) {
        console.error(error);
        alert("Could not process this link. Please try a valid product URL or describe the item.");
        setAppState(AppState.DASHBOARD);
      }
    });
  };

  const getStyleDescriptionWithColor = (item: StyleItem, type: 'hair' | 'fashion') => {
    if (!item.selectedColor) return item.description;

    const isHex = item.selectedColor.startsWith('#');
    const colorTerm = item.selectedColor;

    if (type === 'hair') {
      return `${item.description}. The hair color should be ${isHex ? `exactly hex code ${colorTerm}` : colorTerm}.`;
    } else {
      return `${item.description}. The main fabric color should be ${isHex ? `exactly hex code ${colorTerm}` : colorTerm}.`;
    }
  };

  const handleTryOn = async (item: StyleItem) => {
    if (!userImage) return;

    // Gatekeep
    checkUsageAndProceed(async () => {
      try {
        setAppState(AppState.GENERATING_IMAGE);
        
        const colorPrefix = item.selectedColor ? `${item.selectedColor} ` : "";
        setLoadingMessage(`Magic in progress! Applying ${colorPrefix}${item.name}...`);
        
        const base64Data = userImage.split(',')[1];
        const type = activeTab === 'mix' ? 'fashion' : activeTab; 
        const description = getStyleDescriptionWithColor(item, type as 'hair' | 'fashion');

        const genImg = await visualizeStyle(base64Data, description, type as 'hair' | 'fashion');
        
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          image: genImg,
          styleName: item.name,
          description: description,
          type: type as 'hair' | 'fashion',
          items: [item],
          timestamp: Date.now()
        };
        addToHistory(newItem);
        incrementUsage(); // Deduct credit

        setResultSource('history');
        setAppState(AppState.SHOWING_RESULT);
      } catch (error) {
        console.error(error);
        alert("Generation failed. Please try again.");
        setAppState(AppState.DASHBOARD);
      }
    });
  };

  const handleMixTryOn = async () => {
    if (!userImage || !mixSelection.hair || !mixSelection.outfit) return;

    // Gatekeep
    checkUsageAndProceed(async () => {
      try {
          setAppState(AppState.GENERATING_IMAGE);
          setLoadingMessage("Mixing styles to create your complete look...");

          const hairDesc = getStyleDescriptionWithColor(mixSelection.hair, 'hair');
          const outfitDesc = getStyleDescriptionWithColor(mixSelection.outfit, 'fashion');
          
          const combinedDesc = `Hair: ${hairDesc}. Outfit: ${outfitDesc}.`;
          
          const base64Data = userImage.split(',')[1];
          const genImg = await visualizeStyle(base64Data, combinedDesc, 'mix');

          const newItem: HistoryItem = {
              id: Date.now().toString(),
              image: genImg,
              styleName: "Mix & Match Look",
              description: combinedDesc,
              type: 'mix',
              items: [mixSelection.hair, mixSelection.outfit],
              timestamp: Date.now()
          };
          addToHistory(newItem);
          incrementUsage(); // Deduct credit

          setResultSource('history');
          setAppState(AppState.SHOWING_RESULT);

      } catch (e) {
          console.error(e);
          alert("Mix generation failed.");
          setAppState(AppState.DASHBOARD);
      }
    });
  };

  const addToHistory = (item: HistoryItem) => {
    setHistory(prev => [...prev, item]);
    setCurrentHistoryIndex(prev => prev + 1);
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (resultSource === 'history') {
      if (direction === 'prev' && currentHistoryIndex > 0) {
          setCurrentHistoryIndex(currentHistoryIndex - 1);
      } else if (direction === 'next' && currentHistoryIndex < history.length - 1) {
          setCurrentHistoryIndex(currentHistoryIndex + 1);
      }
    } else {
      if (direction === 'prev' && currentCollectionIndex > 0) {
        setCurrentCollectionIndex(currentCollectionIndex - 1);
      } else if (direction === 'next' && currentCollectionIndex < savedItems.length - 1) {
        setCurrentCollectionIndex(currentCollectionIndex + 1);
      }
    }
  };

  // Collection Handlers
  const handleToggleSave = (item: HistoryItem) => {
    const isSaved = savedItems.some(i => i.id === item.id);
    if (isSaved) {
      setSavedItems(prev => prev.filter(i => i.id !== item.id));
    } else {
      setSavedItems(prev => [item, ...prev]);
    }
  };

  const handleViewCollectionItem = (index: number) => {
    setCurrentCollectionIndex(index);
    setResultSource('collection');
    setAppState(AppState.SHOWING_RESULT);
  };

  const handleDeleteFromCollection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedItems(prev => prev.filter(i => i.id !== id));
  };

  const handleGeneratePreview = async (item: StyleItem) => {
    // Note: Previews are currently free/unlimited to encourage usage, 
    // or we could gatekeep this too. For now, leaving free for better UX.
    if (!userImage || !analysis) return;
    try {
        const base64Data = userImage.split(',')[1];
        const type = activeTab === 'mix' ? 'hair' : activeTab;
        const description = getStyleDescriptionWithColor(item, type as 'hair'|'fashion');

        const genImg = await visualizeStyle(base64Data, description, type as 'hair'|'fashion');
        
        setAnalysis(prev => {
            if (!prev) return null;
            const updateList = (list: StyleItem[]) => 
                list.map(i => i.name === item.name ? { ...i, thumbnail: genImg } : i);
            
            return {
                ...prev,
                hairStyles: updateList(prev.hairStyles),
                outfits: updateList(prev.outfits)
            };
        });

    } catch (e) {
        console.error("Preview generation failed", e);
    }
  };

  const handleColorChange = (item: StyleItem, color: string) => {
     setAnalysis(prev => {
        if (!prev) return null;
        const updateList = (list: StyleItem[]) => 
            list.map(i => i.name === item.name ? { ...i, selectedColor: color, thumbnail: undefined } : i);
        
        return {
            ...prev,
            hairStyles: updateList(prev.hairStyles),
            outfits: updateList(prev.outfits)
        };
     });
     
     if (mixSelection.hair?.name === item.name) {
         setMixSelection(prev => ({ ...prev, hair: { ...item, selectedColor: color } }));
     }
     if (mixSelection.outfit?.name === item.name) {
         setMixSelection(prev => ({ ...prev, outfit: { ...item, selectedColor: color } }));
     }
  };

  const handleAction = async (item: StyleItem, typeOverride?: 'hair' | 'fashion') => {
    try {
      setSelectedStyleForAction(item);
      const actionType = typeOverride || (activeTab === 'mix' ? 'fashion' : activeTab);
      
      setLoadingMessage(actionType === 'hair' ? "Locating top-rated salons nearby..." : "Finding shopping links...");
      setAppState(AppState.ANALYZING); 
      
      let results;
      if (actionType === 'hair') {
        if (!location) {
          alert("Please enable location services to find salons.");
          setAppState(AppState.SHOWING_RESULT); // Return to result
          return;
        }
        results = await findNearbySalons(location);
      } else {
        const query = item.selectedColor 
            ? `${item.selectedColor} ${item.name} ${item.description}` 
            : `${item.name} ${item.description}`;
        results = await findShoppingLinks(query);
      }
      
      setGroundingResults(results);
      setShowGroundingModal(true);
      setAppState(AppState.SHOWING_RESULT);

    } catch (error) {
      console.error(error);
      alert("Search failed. Check your API configuration.");
      setAppState(AppState.SHOWING_RESULT);
    }
  };

  const handleShare = async () => {
    const currentItem = resultSource === 'history' ? history[currentHistoryIndex] : savedItems[currentCollectionIndex];
    if (!currentItem) return;

    try {
      const base64Response = await fetch(currentItem.image);
      const blob = await base64Response.blob();
      const file = new File([blob], "style-genie-look.jpg", { type: "image/jpeg" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My New Look with StyleGenie',
          text: `Check out this look I generated with StyleGenie AI!`,
          files: [file],
        });
      } else {
        alert("Sharing not supported on this device. Try the Download button instead!");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleDownload = () => {
    const currentItem = resultSource === 'history' ? history[currentHistoryIndex] : savedItems[currentCollectionIndex];
    if (!currentItem) return;
    const link = document.createElement('a');
    link.href = currentItem.image;
    const safeName = currentItem.styleName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    link.download = `style-genie-${safeName}-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCloseGrounding = () => {
    setShowGroundingModal(false);
    setGroundingResults(null);
  };

  const handleBackToDashboard = () => {
    if (resultSource === 'collection') {
        setAppState(AppState.COLLECTION);
    } else {
        setAppState(AppState.DASHBOARD);
    }
  };

  // Render Helpers
  const renderUpload = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center max-w-md mx-auto">
      <div className="mb-8 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary blur-3xl opacity-20 rounded-full"></div>
        <Sparkles className="w-20 h-20 text-primary relative z-10" />
      </div>
      <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary mb-4">
        StyleGenie
      </h1>
      <p className="text-gray-400 mb-8 text-lg">
        Upload a selfie to discover your perfect hairstyle and trendy fashion looks powered by AI.
      </p>
      
      <label className="w-full">
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleImageUpload}
        />
        <div className="bg-surface hover:bg-slate-700 border-2 border-dashed border-gray-600 hover:border-primary transition-all rounded-2xl p-8 cursor-pointer flex flex-col items-center group">
          <Upload className="w-12 h-12 text-gray-400 group-hover:text-primary mb-4 transition-colors" />
          <span className="text-lg font-medium text-gray-300 group-hover:text-white">Upload Photo</span>
          <span className="text-sm text-gray-500 mt-2">or take a selfie</span>
        </div>
      </label>
      <div className="mt-8 text-xs text-gray-500">
         30-Day Free Trial (10 styles/day)
      </div>
    </div>
  );

  const renderHeader = () => (
    <header className="sticky top-0 bg-dark/90 backdrop-blur-md z-10 border-b border-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2" onClick={() => setAppState(AppState.DASHBOARD)}>
           <img 
            src={userImage || ""} 
            alt="User" 
            className="w-10 h-10 rounded-full object-cover border-2 border-primary cursor-pointer" 
          />
          <h2 className="font-bold text-lg cursor-pointer">StyleGenie</h2>
        </div>
        <div className="flex items-center gap-3">
            {/* Usage Counter */}
            <div 
              className="text-xs font-medium px-3 py-1.5 rounded-full bg-surface border border-gray-700 text-gray-300 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setShowSubscriptionModal(true)}
            >
               {usage.dailyCount}/{getDailyLimit() + usage.extraDailyLimit} Used
            </div>

            <button 
            onClick={() => { setAppState(AppState.UPLOAD); setHistory([]); setSavedItems([]); setUserImage(null); }}
            className="text-sm text-gray-400 hover:text-white"
            >
            New
            </button>
        </div>
      </header>
  );

  const renderDashboard = () => (
    <div className="min-h-screen pb-20">
      {renderHeader()}

      {/* Analysis Summary */}
      <div className="p-4 bg-gradient-to-b from-surface to-dark">
        <div className="flex items-center gap-3 text-sm text-gray-300 mb-2">
          <span className="bg-white/10 px-3 py-1 rounded-full">Face: <b className="text-white">{analysis?.faceShape}</b></span>
          <span className="bg-white/10 px-3 py-1 rounded-full">Skin: <b className="text-white">{analysis?.skinTone}</b></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button 
          onClick={() => { setActiveTab('hair'); setSearchMode('text'); }}
          className={`flex-1 py-4 font-medium flex items-center justify-center gap-2 relative ${activeTab === 'hair' ? 'text-primary' : 'text-gray-400'}`}
        >
          <Scissors size={20} />
          Hairstyles
          {activeTab === 'hair' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('fashion')}
          className={`flex-1 py-4 font-medium flex items-center justify-center gap-2 relative ${activeTab === 'fashion' ? 'text-secondary' : 'text-gray-400'}`}
        >
          <Shirt size={20} />
          Fashion
          {activeTab === 'fashion' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-secondary"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('mix')}
          className={`flex-1 py-4 font-medium flex items-center justify-center gap-2 relative ${activeTab === 'mix' ? 'text-purple-400' : 'text-gray-400'}`}
        >
          <Layers size={20} />
          Mix Match
          {activeTab === 'mix' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-500"></div>}
        </button>
      </div>
      
      {/* Hair Color Filters */}
      {activeTab === 'hair' && (
        <div className="px-4 py-3 bg-surface/30 border-b border-gray-800 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-2 items-center">
            <span className="text-xs font-medium text-gray-400 flex items-center gap-1 mr-1"><Filter size={12} /> Color:</span>
            <button 
                onClick={() => handleColorFilterChange(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${!activeColorFilter ? 'bg-gray-700 text-white border-gray-500' : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'}`}
            >
                Default
            </button>
            {HAIR_COLOR_FILTERS.map(color => (
                <button
                    key={color.name}
                    onClick={() => handleColorFilterChange(color.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-2 transition-all ${activeColorFilter === color.name ? 'bg-primary/20 text-white border-primary' : 'bg-transparent text-gray-300 border-gray-700 hover:border-gray-500'}`}
                >
                    <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: color.hex }}></div>
                    {color.name}
                </button>
            ))}
        </div>
      )}

      {/* Search / Link Input (Hidden for Mix) */}
      {activeTab !== 'mix' && (
      <div className="p-4 bg-surface/50 border-b border-gray-800">
        <div className="flex gap-2 mb-2">
           <button 
             type="button" 
             onClick={() => setSearchMode('text')} 
             className={`text-xs px-3 py-1 rounded-full border ${searchMode === 'text' ? 'bg-primary/20 border-primary text-primary' : 'border-gray-700 text-gray-400'}`}
           >
             Text Search
           </button>
           {activeTab === 'fashion' && (
             <button 
               type="button" 
               onClick={() => setSearchMode('link')} 
               className={`text-xs px-3 py-1 rounded-full border ${searchMode === 'link' ? 'bg-secondary/20 border-secondary text-secondary' : 'border-gray-700 text-gray-400'}`}
             >
               Paste URL
             </button>
           )}
        </div>
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
             {searchMode === 'text' ? (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
             ) : (
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
             )}
             
             <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder={
                searchMode === 'link' 
                ? "Paste product URL (e.g. zara.com/dress...)" 
                : activeTab === 'hair' 
                  ? "Describe a hairstyle..." 
                  : "Describe an outfit..."
              }
              className={`w-full bg-dark border border-gray-700 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-${searchMode === 'link' ? 'secondary' : 'primary'} text-white placeholder-gray-500 text-sm`}
            />
          </div>
          <button 
            type="submit" 
            className={`${searchMode === 'link' ? 'bg-secondary hover:bg-secondary/90' : 'bg-primary hover:bg-primary/90'} text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap`}
          >
            {searchMode === 'link' ? 'Try On' : 'Find'}
          </button>
        </form>
      </div>
      )}

      {/* Content Grid */}
      {activeTab === 'mix' ? (
         <div className="p-4 space-y-6">
            <div>
               <h3 className="text-primary font-bold mb-3 flex items-center gap-2"><Scissors size={18}/> Select Hairstyle</h3>
               <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
                  {analysis?.hairStyles.map((style, idx) => (
                    <div key={`mix-hair-${idx}`} className="w-64 flex-shrink-0">
                       <StyleCard 
                          item={style} 
                          type="hair"
                          onColorChange={handleColorChange}
                          isSelectable={true}
                          isSelected={mixSelection.hair?.name === style.name}
                          onSelect={(item) => setMixSelection(prev => ({ ...prev, hair: item }))}
                       />
                    </div>
                  ))}
                  <div className="w-48 flex-shrink-0">
                    <button 
                        onClick={handleRequestMore}
                        className="w-full h-full min-h-[200px] bg-surface/50 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center hover:border-gray-500 hover:bg-surface transition-all gap-2 group"
                    >
                        <RefreshCcw className="w-8 h-8 text-gray-500 group-hover:text-primary transition-colors" />
                        <span className="text-gray-400 font-medium text-sm group-hover:text-gray-300">Load More Styles</span>
                    </button>
                  </div>
               </div>
            </div>
            
            <div>
               <h3 className="text-secondary font-bold mb-3 flex items-center gap-2"><Shirt size={18}/> Select Outfit</h3>
               <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
                  {analysis?.outfits.map((style, idx) => (
                    <div key={`mix-outfit-${idx}`} className="w-64 flex-shrink-0">
                       <StyleCard 
                          item={style} 
                          type="fashion"
                          onColorChange={handleColorChange}
                          isSelectable={true}
                          isSelected={mixSelection.outfit?.name === style.name}
                          onSelect={(item) => setMixSelection(prev => ({ ...prev, outfit: item }))}
                       />
                    </div>
                  ))}
                  <div className="w-48 flex-shrink-0">
                    <button 
                        onClick={handleRequestMore}
                        className="w-full h-full min-h-[200px] bg-surface/50 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center hover:border-gray-500 hover:bg-surface transition-all gap-2 group"
                    >
                        <RefreshCcw className="w-8 h-8 text-gray-500 group-hover:text-secondary transition-colors" />
                        <span className="text-gray-400 font-medium text-sm group-hover:text-gray-300">Load More Styles</span>
                    </button>
                  </div>
               </div>
            </div>

            <button 
               onClick={handleMixTryOn}
               disabled={!mixSelection.hair || !mixSelection.outfit}
               className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all
                  ${(!mixSelection.hair || !mixSelection.outfit) 
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-primary to-secondary hover:opacity-90'
                  }`}
            >
               <Sparkles />
               Visualize Complete Look
            </button>
         </div>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTab === 'hair' ? (
            <>
              {analysis?.hairStyles.map((style, idx) => (
                <StyleCard 
                  key={`hair-${idx}`} 
                  item={style} 
                  type="hair" 
                  onTryOn={handleTryOn} 
                  onAction={(item) => handleAction(item)} 
                  onGeneratePreview={handleGeneratePreview}
                  onColorChange={handleColorChange}
                />
              ))}
            </>
          ) : (
            <>
              {analysis?.outfits.map((style, idx) => (
                <StyleCard 
                  key={`outfit-${idx}`} 
                  item={style} 
                  type="fashion" 
                  onTryOn={handleTryOn} 
                  onAction={(item) => handleAction(item)}
                  onGeneratePreview={handleGeneratePreview}
                  onColorChange={handleColorChange} 
                />
              ))}
            </>
          )}
          <button 
              onClick={handleRequestMore}
              className="bg-surface border-2 border-dashed border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center min-h-[160px] hover:border-gray-500 transition-colors"
            >
              <RefreshCcw className="w-8 h-8 text-gray-500 mb-2" />
              <span className="text-gray-400 font-medium">Load More Styles</span>
            </button>
        </div>
      )}
    </div>
  );

  const renderCollection = () => (
    <div className="min-h-screen pb-20 bg-dark">
        {renderHeader()}
        <div className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Bookmark className="text-primary" /> My Collection
            </h2>
            
            {savedItems.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <Grid size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No saved styles yet.</p>
                    <p className="text-sm mt-2">Generate styles and click the heart icon to save them here.</p>
                    <button 
                        onClick={() => setAppState(AppState.DASHBOARD)}
                        className="mt-6 text-primary hover:text-white underline"
                    >
                        Go to Dashboard
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {savedItems.map((item, index) => (
                        <div 
                            key={item.id} 
                            onClick={() => handleViewCollectionItem(index)}
                            className="bg-surface rounded-xl overflow-hidden border border-gray-700 hover:border-white transition-all cursor-pointer group relative"
                        >
                            <div className="aspect-[3/4] overflow-hidden">
                                <img src={item.image} alt={item.styleName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>
                            <div className="p-3">
                                <h4 className="font-bold text-white text-sm truncate">{item.styleName}</h4>
                                <p className="text-xs text-gray-400 capitalize">{item.type} • {new Date(item.timestamp).toLocaleDateString()}</p>
                            </div>
                            <button 
                                onClick={(e) => handleDeleteFromCollection(e, item.id)}
                                className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"
                                title="Remove from collection"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );

  const renderResult = () => {
    // Determine which item to show based on source
    const currentItem = resultSource === 'history' 
        ? history[currentHistoryIndex] 
        : savedItems[currentCollectionIndex];
        
    if (!currentItem) return null;

    const isSaved = savedItems.some(i => i.id === currentItem.id);
    const totalItems = resultSource === 'history' ? history.length : savedItems.length;
    const currentIndex = resultSource === 'history' ? currentHistoryIndex : currentCollectionIndex;

    return (
    <div className="min-h-screen bg-dark flex flex-col">
       <header className="p-4 flex items-center gap-4 bg-transparent absolute top-0 w-full z-10 justify-between">
        <button 
          onClick={handleBackToDashboard}
          className="bg-black/50 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/20 transition-colors"
        >
          <X size={24} />
        </button>
        <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white">
           {resultSource === 'collection' ? 'Saved Item' : 'Generated Result'} {currentIndex + 1} of {totalItems}
        </div>
      </header>
      
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group">
        <img 
            src={currentItem.image} 
            alt="Generated Style" 
            className="max-w-full max-h-screen object-contain"
        />

        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button 
            onClick={() => handleNavigate('prev')}
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/20 transition-all opacity-0 group-hover:opacity-100"
          >
            <ArrowLeft size={24} />
          </button>
        )}
        {currentIndex < totalItems - 1 && (
          <button 
            onClick={() => handleNavigate('next')}
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/20 transition-all opacity-0 group-hover:opacity-100"
          >
            <ArrowRight size={24} />
          </button>
        )}
      </div>

      <div className="bg-surface p-6 rounded-t-3xl shadow-2xl z-10 -mt-6">
        <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-1 bg-gray-600 rounded-full"></div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{currentItem.styleName}</h2>
        <p className="text-gray-400 mb-6 text-sm line-clamp-2">
           {currentItem.description}
        </p>
        
        <div className="flex flex-col gap-3">
            {/* Contextual Action Button based on what is shown */}
            {currentItem.type === 'mix' ? (
                <div className="flex gap-2">
                    <button 
                        onClick={() => handleAction(currentItem.items[0], 'hair')}
                        className="flex-1 py-4 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 shadow-lg flex items-center justify-center gap-2"
                    >
                        <MapPin size={18} /> Find Salons
                    </button>
                    <button 
                        onClick={() => handleAction(currentItem.items[1], 'fashion')}
                        className="flex-1 py-4 rounded-xl font-bold text-white bg-secondary hover:bg-secondary/90 shadow-lg flex items-center justify-center gap-2"
                    >
                        <ShoppingBag size={18} /> Shop Outfit
                    </button>
                </div>
            ) : (
                <button 
                onClick={() => handleAction(currentItem.items[0], currentItem.type === 'hair' ? 'hair' : 'fashion')}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 ${
                    currentItem.type === 'hair' ? 'bg-primary hover:bg-primary/90' : 'bg-secondary hover:bg-secondary/90'
                }`}
                >
                {currentItem.type === 'hair' ? <MapPin /> : <ShoppingBag />}
                {currentItem.type === 'hair' ? 'Find Salons' : 'Shop This Look'}
                </button>
            )}

            {/* Secondary Action Buttons (Share, Save, Download) */}
            <div className="flex gap-3">
                <button
                onClick={handleShare}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-gray-700 hover:bg-gray-600 shadow-lg flex items-center justify-center gap-2 transition-colors"
                >
                <Share2 size={20} />
                Share
                </button>

                <button
                onClick={handleDownload}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-gray-700 hover:bg-gray-600 shadow-lg flex items-center justify-center gap-2 transition-colors"
                >
                <Download size={20} />
                DL
                </button>
            </div>
        </div>
      </div>
    </div>
  );
  };

  const renderGroundingModal = () => {
    if (!showGroundingModal || !groundingResults) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto" onClick={handleCloseGrounding}></div>
        <div className="bg-surface w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl relative pointer-events-auto p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    {activeTab === 'hair' ? <MapPin className="text-primary" /> : <ShoppingBag className="text-secondary" />}
                    {activeTab === 'hair' ? 'Nearby Salons' : 'Shopping Links'}
                </h3>
                <button onClick={handleCloseGrounding} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>

            <div className="space-y-4">
                {groundingResults.chunks.length > 0 ? (
                    groundingResults.chunks.map((chunk, i) => {
                        const isMap = !!chunk.maps;
                        const uri = isMap ? chunk.maps?.uri : chunk.web?.uri;
                        const title = isMap ? chunk.maps?.title : chunk.web?.title;
                        const snippet = isMap 
                            ? chunk.maps?.placeAnswerSources?.[0]?.reviewSnippets?.[0]?.content 
                            : chunk.web?.snippet;

                        if (!uri || !title) return null;

                        return (
                            <a 
                                key={i} 
                                href={uri} 
                                target="_blank" 
                                rel="noreferrer"
                                className="block bg-dark border border-gray-700 hover:border-white/50 p-4 rounded-xl transition-all group"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-semibold text-white group-hover:text-primary transition-colors">{title}</h4>
                                        {snippet && <p className="text-sm text-gray-400 mt-1 line-clamp-2">"{snippet}"</p>}
                                        <span className="text-xs text-blue-400 mt-2 inline-flex items-center gap-1">
                                            {isMap ? 'View on Google Maps' : 'Visit Store'} <ExternalLink size={10} />
                                        </span>
                                    </div>
                                    <ChevronRight className="text-gray-600 group-hover:text-white" />
                                </div>
                            </a>
                        );
                    })
                ) : (
                    <div className="text-center py-10">
                        <AlertCircle className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                        <p className="text-gray-400">No direct links found.</p>
                        <p className="text-sm text-gray-500 mt-2">{groundingResults.text}</p>
                    </div>
                )}
                
                 <div className="mt-4 text-xs text-gray-500 border-t border-gray-800 pt-4">
                    AI suggestions based on available data. Always verify hours and availability.
                 </div>
            </div>
        </div>
      </div>
    );
  };

  const renderSubscriptionModal = () => {
    if (!showSubscriptionModal) return null;

    const currentLimit = getDailyLimit();
    const isFreeExpired = currentLimit === 0 && usage.tier === 'free';
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowSubscriptionModal(false)}></div>
        <div className="bg-surface w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative pointer-events-auto flex flex-col animate-in fade-in zoom-in duration-300">
           
           <div className="p-6 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-surface z-10">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                   <Crown className="text-yellow-400 fill-yellow-400" /> Upgrade Plan
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                   {isFreeExpired ? "Your free trial has ended." : "You've reached your daily styling limit."}
                </p>
              </div>
              <button onClick={() => setShowSubscriptionModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
           </div>

           <div className="p-6 space-y-6">
              
              {/* Option 1: Day Pass */}
              <div className="bg-gradient-to-r from-blue-900/40 to-blue-800/40 border border-blue-500/50 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                     <div className="bg-blue-500/20 p-3 rounded-full text-blue-400"><Zap size={24} /></div>
                     <div>
                        <h4 className="font-bold text-lg text-white">Day Pass</h4>
                        <p className="text-sm text-gray-300">Get 10 more styles for today instantly.</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => handlePurchase('day_pass', 10)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg whitespace-nowrap transition-colors"
                  >
                    Pay ₹10
                  </button>
              </div>

              <div className="text-center text-gray-500 text-sm font-medium uppercase tracking-widest my-4">- OR Choose a Subscription -</div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Monthly */}
                  <div className={`border rounded-xl p-5 flex flex-col relative transition-all hover:scale-105 ${usage.tier === 'monthly' ? 'bg-secondary/10 border-secondary' : 'bg-dark border-gray-700'}`}>
                      {usage.tier === 'monthly' && <div className="absolute top-2 right-2 text-secondary"><CheckCircle2 size={20} /></div>}
                      <h4 className="font-bold text-lg text-white mb-1">Monthly</h4>
                      <div className="text-3xl font-extrabold text-white mb-2">₹300<span className="text-sm font-normal text-gray-400">/mo</span></div>
                      <ul className="text-sm text-gray-400 space-y-2 mb-6 flex-1">
                         <li className="flex gap-2"><CheckCircle2 size={14} className="text-green-400" /> 20 Styles / Day</li>
                         <li className="flex gap-2"><CheckCircle2 size={14} className="text-green-400" /> Recurring Billing</li>
                      </ul>
                      <button 
                        onClick={() => handlePurchase('monthly', 300)}
                        disabled={usage.tier === 'monthly'}
                        className={`w-full py-2 rounded-lg font-bold text-sm ${usage.tier === 'monthly' ? 'bg-secondary/20 text-secondary' : 'bg-white text-black hover:bg-gray-200'}`}
                      >
                        {usage.tier === 'monthly' ? 'Active Plan' : 'Select'}
                      </button>
                  </div>

                  {/* Yearly - Best Value */}
                  <div className={`border rounded-xl p-5 flex flex-col relative transition-all hover:scale-105 transform scale-105 shadow-xl ${usage.tier === 'yearly' ? 'bg-primary/10 border-primary' : 'bg-dark border-primary'}`}>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase">Best Value</div>
                      {usage.tier === 'yearly' && <div className="absolute top-2 right-2 text-primary"><CheckCircle2 size={20} /></div>}
                      <h4 className="font-bold text-lg text-white mb-1">Yearly</h4>
                      <div className="text-3xl font-extrabold text-white mb-2">₹6000<span className="text-sm font-normal text-gray-400">/yr</span></div>
                      <ul className="text-sm text-gray-400 space-y-2 mb-6 flex-1">
                         <li className="flex gap-2"><CheckCircle2 size={14} className="text-green-400" /> 50 Styles / Day</li>
                         <li className="flex gap-2"><CheckCircle2 size={14} className="text-green-400" /> Save ₹1200/yr</li>
                      </ul>
                      <button 
                        onClick={() => handlePurchase('yearly', 6000)}
                        disabled={usage.tier === 'yearly'}
                        className={`w-full py-2 rounded-lg font-bold text-sm ${usage.tier === 'yearly' ? 'bg-primary/20 text-primary' : 'bg-primary text-white hover:bg-primary/90'}`}
                      >
                        {usage.tier === 'yearly' ? 'Active Plan' : 'Select'}
                      </button>
                  </div>

                  {/* Lifetime */}
                  <div className={`border rounded-xl p-5 flex flex-col relative transition-all hover:scale-105 ${usage.tier === 'lifetime' ? 'bg-purple-900/20 border-purple-500' : 'bg-dark border-gray-700'}`}>
                      {usage.tier === 'lifetime' && <div className="absolute top-2 right-2 text-purple-400"><CheckCircle2 size={20} /></div>}
                      <h4 className="font-bold text-lg text-white mb-1">Lifetime</h4>
                      <div className="text-3xl font-extrabold text-white mb-2">₹36k<span className="text-sm font-normal text-gray-400"></span></div>
                      <ul className="text-sm text-gray-400 space-y-2 mb-6 flex-1">
                         <li className="flex gap-2"><CheckCircle2 size={14} className="text-green-400" /> 150 Styles / Day</li>
                         <li className="flex gap-2"><CheckCircle2 size={14} className="text-green-400" /> One-time Payment</li>
                      </ul>
                      <button 
                        onClick={() => handlePurchase('lifetime', 36000)}
                        disabled={usage.tier === 'lifetime'}
                        className={`w-full py-2 rounded-lg font-bold text-sm ${usage.tier === 'lifetime' ? 'bg-purple-500/20 text-purple-400' : 'bg-white text-black hover:bg-gray-200'}`}
                      >
                        {usage.tier === 'lifetime' ? 'Active Plan' : 'Select'}
                      </button>
                  </div>

              </div>
           </div>

           <div className="p-6 bg-dark/50 border-t border-gray-800 text-xs text-gray-500 text-center">
              Secure payment processing. Plans can be cancelled anytime.
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-dark min-h-screen text-white font-sans selection:bg-primary/30">
      {(appState === AppState.ANALYZING || appState === AppState.GENERATING_IMAGE) && (
        <LoadingOverlay message={loadingMessage} />
      )}
      
      {appState === AppState.UPLOAD && renderUpload()}
      {appState === AppState.DASHBOARD && renderDashboard()}
      {appState === AppState.COLLECTION && renderCollection()}
      {appState === AppState.SHOWING_RESULT && renderResult()}
      
      {renderGroundingModal()}
      {renderSubscriptionModal()}
    </div>
  );
};

export default App;