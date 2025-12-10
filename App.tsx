import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Scissors, Shirt, MapPin, RefreshCcw, Sparkles, ExternalLink, ChevronRight, AlertCircle, X, ShoppingBag, Search, Link as LinkIcon, Share2 } from 'lucide-react';
import { analyzeImageAndSuggestStyles, visualizeStyle, findNearbySalons, findShoppingLinks, getOutfitDescriptionFromUrl } from './services/geminiService';
import { AnalysisResult, StyleItem, GroundingChunk, Coordinates } from './types';
import LoadingOverlay from './components/LoadingOverlay';
import StyleCard from './components/StyleCard';

enum AppState {
  UPLOAD,
  ANALYZING,
  DASHBOARD,
  GENERATING_IMAGE,
  SHOWING_RESULT
}

const App: React.FC = () => {
  // State
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'hair' | 'fashion'>('hair');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StyleItem | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [customQuery, setCustomQuery] = useState<string>("");
  const [searchMode, setSearchMode] = useState<'text' | 'link'>('text');
  
  // Grounding Results (Salons or Shopping)
  const [groundingResults, setGroundingResults] = useState<{text: string, chunks: GroundingChunk[]} | null>(null);
  const [showGroundingModal, setShowGroundingModal] = useState(false);
  
  // Location
  const [location, setLocation] = useState<Coordinates | null>(null);

  useEffect(() => {
    // Get location on mount
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
  }, []);

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

  const handleRequestMore = async () => {
    if (!userImage || !analysis) return;
    try {
      setLoadingMessage("Consulting the AI stylist for more ideas...");
      setAppState(AppState.ANALYZING); 
      const base64Data = userImage.split(',')[1];
      
      const requestType = activeTab === 'hair' ? 'more_hair' : 'more_fashion';
      const newResult = await analyzeImageAndSuggestStyles(base64Data, requestType);
      
      setAnalysis(prev => {
        if (!prev) return newResult;
        return {
          ...prev,
          hairStyles: requestType === 'more_hair' ? [...prev.hairStyles, ...newResult.hairStyles] : prev.hairStyles,
          outfits: requestType === 'more_fashion' ? [...prev.outfits, ...newResult.outfits] : prev.outfits 
        };
      });
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
    try {
      setLoadingMessage("Analyzing product link...");
      setAppState(AppState.ANALYZING);

      // 1. Get description from URL
      const description = await getOutfitDescriptionFromUrl(customQuery);
      
      // 2. Visualize
      setLoadingMessage("Trying on the item from the link...");
      const base64Data = userImage!.split(',')[1];
      const genImg = await visualizeStyle(base64Data, description, 'fashion');

      setGeneratedImage(genImg);
      setSelectedStyle({ name: "Linked Outfit", description: description });
      setCustomQuery("");
      setAppState(AppState.SHOWING_RESULT);
    } catch (error) {
      console.error(error);
      alert("Could not process this link. Please try a valid product URL or describe the item.");
      setAppState(AppState.DASHBOARD);
    }
  };

  const handleTryOn = async (item: StyleItem) => {
    if (!userImage) return;
    try {
      setSelectedStyle(item);
      setAppState(AppState.GENERATING_IMAGE);
      
      const colorPrefix = item.selectedColor ? `${item.selectedColor} ` : "";
      setLoadingMessage(`Magic in progress! Applying ${colorPrefix}${item.name}...`);
      
      const base64Data = userImage.split(',')[1];
      const description = item.selectedColor 
        ? `A ${item.selectedColor} version of: ${item.description}` 
        : item.description;

      const genImg = await visualizeStyle(base64Data, description, activeTab);
      
      setGeneratedImage(genImg);
      setAppState(AppState.SHOWING_RESULT);
    } catch (error) {
      console.error(error);
      alert("Generation failed. Please try again.");
      setAppState(AppState.DASHBOARD);
    }
  };

  const handleGeneratePreview = async (item: StyleItem) => {
    if (!userImage || !analysis) return;
    try {
        const base64Data = userImage.split(',')[1];
        
        const colorPrefix = item.selectedColor ? `${item.selectedColor} ` : "";
        const description = item.selectedColor 
            ? `A ${item.selectedColor} version of: ${item.description}` 
            : item.description;

        const genImg = await visualizeStyle(base64Data, description, activeTab);
        
        // Update the item in the list with the thumbnail
        setAnalysis(prev => {
            if (!prev) return null;
            const updateList = (list: StyleItem[]) => 
                list.map(i => i.name === item.name ? { ...i, thumbnail: genImg } : i);
            
            return {
                ...prev,
                hairStyles: activeTab === 'hair' ? updateList(prev.hairStyles) : prev.hairStyles,
                outfits: activeTab === 'fashion' ? updateList(prev.outfits) : prev.outfits
            };
        });

    } catch (e) {
        console.error("Preview generation failed", e);
        // Silent failure for preview
    }
  };

  const handleColorChange = (item: StyleItem, color: string) => {
     setAnalysis(prev => {
        if (!prev) return null;
        const updateList = (list: StyleItem[]) => 
            list.map(i => i.name === item.name ? { ...i, selectedColor: color, thumbnail: undefined } : i); // Reset thumbnail on color change
        
        return {
            ...prev,
            hairStyles: prev.hairStyles,
            outfits: updateList(prev.outfits)
        };
     });
  };

  const handleAction = async (item: StyleItem) => {
    try {
      setSelectedStyle(item);
      setLoadingMessage(activeTab === 'hair' ? "Locating top-rated salons nearby..." : "Finding shopping links...");
      setAppState(AppState.ANALYZING); 
      
      let results;
      if (activeTab === 'hair') {
        if (!location) {
          alert("Please enable location services to find salons.");
          setAppState(AppState.DASHBOARD);
          return;
        }
        results = await findNearbySalons(location);
      } else {
        const colorPrefix = item.selectedColor ? `${item.selectedColor} ` : "";
        const query = item.selectedColor 
            ? `Buy ${item.selectedColor} ${item.name} ${item.description}` 
            : item.description;
        results = await findShoppingLinks(query);
      }
      
      setGroundingResults(results);
      setShowGroundingModal(true);
      setAppState(AppState.DASHBOARD);
    } catch (error) {
      console.error(error);
      alert("Search failed.");
      setAppState(AppState.DASHBOARD);
    }
  };

  const handleShare = async () => {
    if (!generatedImage) return;

    try {
      // Convert base64 to blob
      const base64Response = await fetch(generatedImage);
      const blob = await base64Response.blob();
      const file = new File([blob], "style-genie-look.jpg", { type: "image/jpeg" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My New Look with StyleGenie',
          text: `Check out this ${activeTab === 'hair' ? 'hairstyle' : 'outfit'} I generated with StyleGenie AI!`,
          files: [file],
        });
      } else {
        // Fallback: Download the image
        const link = document.createElement('a');
        link.href = generatedImage;
        link.download = "style-genie-look.jpg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert("Image downloaded! You can now share it manually.");
      }
    } catch (error) {
      console.error("Error sharing:", error);
      // Fallback for any other errors
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = "style-genie-look.jpg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCloseGrounding = () => {
    setShowGroundingModal(false);
    setGroundingResults(null);
  };

  const handleBackToDashboard = () => {
    setAppState(AppState.DASHBOARD);
    setGeneratedImage(null);
    setSelectedStyle(null);
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
    </div>
  );

  const renderDashboard = () => (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-dark/90 backdrop-blur-md z-10 border-b border-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <img 
            src={userImage || ""} 
            alt="User" 
            className="w-10 h-10 rounded-full object-cover border-2 border-primary" 
          />
          <h2 className="font-bold text-lg">StyleGenie</h2>
        </div>
        <button 
          onClick={() => setAppState(AppState.UPLOAD)}
          className="text-sm text-gray-400 hover:text-white"
        >
          New Photo
        </button>
      </header>

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
      </div>

      {/* Search / Link Input */}
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

      {/* Content Grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeTab === 'hair' ? (
          <>
            {analysis?.hairStyles.map((style, idx) => (
              <StyleCard 
                key={`hair-${idx}`} 
                item={style} 
                type="hair" 
                onTryOn={handleTryOn} 
                onAction={handleAction} 
                onGeneratePreview={handleGeneratePreview}
                onColorChange={handleColorChange}
              />
            ))}
            <button 
              onClick={handleRequestMore}
              className="bg-surface border-2 border-dashed border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center min-h-[160px] hover:border-gray-500 transition-colors"
            >
              <RefreshCcw className="w-8 h-8 text-gray-500 mb-2" />
              <span className="text-gray-400 font-medium">Load More Styles</span>
            </button>
          </>
        ) : (
          <>
            {analysis?.outfits.map((style, idx) => (
              <StyleCard 
                key={`outfit-${idx}`} 
                item={style} 
                type="fashion" 
                onTryOn={handleTryOn} 
                onAction={handleAction}
                onGeneratePreview={handleGeneratePreview}
                onColorChange={handleColorChange} 
              />
            ))}
            <button 
              onClick={handleRequestMore}
              className="bg-surface border-2 border-dashed border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center min-h-[160px] hover:border-gray-500 transition-colors"
            >
              <RefreshCcw className="w-8 h-8 text-gray-500 mb-2" />
              <span className="text-gray-400 font-medium">Load More Looks</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="min-h-screen bg-dark flex flex-col">
       <header className="p-4 flex items-center gap-4 bg-transparent absolute top-0 w-full z-10">
        <button 
          onClick={handleBackToDashboard}
          className="bg-black/50 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/20 transition-colors"
        >
          <X size={24} />
        </button>
      </header>
      
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {/* Compare slider could be cool, but simplistic side-by-side or toggle is easier for MVP */}
        {generatedImage && (
          <img 
            src={generatedImage} 
            alt="Generated Style" 
            className="max-w-full max-h-screen object-contain"
          />
        )}
      </div>

      <div className="bg-surface p-6 rounded-t-3xl shadow-2xl z-10 -mt-6">
        <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-1 bg-gray-600 rounded-full"></div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{selectedStyle?.name}</h2>
        <p className="text-gray-400 mb-6">
           {selectedStyle?.selectedColor ? `${selectedStyle.selectedColor} ` : ''} 
           {selectedStyle?.description}
        </p>
        
        <div className="flex gap-3">
            <button 
            onClick={() => selectedStyle && handleAction(selectedStyle)}
            className={`flex-1 py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 ${
                activeTab === 'hair' ? 'bg-primary hover:bg-primary/90' : 'bg-secondary hover:bg-secondary/90'
            }`}
            >
            {activeTab === 'hair' ? <MapPin /> : <ShoppingBag />}
            {activeTab === 'hair' ? 'Find Salons' : 'Shop This Look'}
            </button>

            <button
            onClick={handleShare}
            className="px-6 py-4 rounded-xl font-bold text-white bg-gray-700 hover:bg-gray-600 shadow-lg flex items-center justify-center gap-2 transition-colors"
            title="Share"
            >
            <Share2 size={24} />
            </button>
        </div>
      </div>
    </div>
  );

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
                {/* 
                   Maps Grounding sometimes returns unstructured text with integrated links in Markdown, 
                   or chunks. We prioritize chunks for clean UI.
                */}
                {groundingResults.chunks.length > 0 ? (
                    groundingResults.chunks.map((chunk, i) => {
                        const isMap = !!chunk.maps;
                        const uri = isMap ? chunk.maps?.uri : chunk.web?.uri;
                        const title = isMap ? chunk.maps?.title : chunk.web?.title;
                        const snippet = isMap ? chunk.maps?.placeAnswerSources?.[0]?.reviewSnippets?.[0]?.content : null;

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
                
                {/* Fallback to text if needed, but usually chunks cover it */}
                 <div className="mt-4 text-xs text-gray-500 border-t border-gray-800 pt-4">
                    AI suggestions based on available data. Always verify hours and availability.
                 </div>
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
      {appState === AppState.SHOWING_RESULT && renderResult()}
      
      {renderGroundingModal()}
    </div>
  );
};

export default App;