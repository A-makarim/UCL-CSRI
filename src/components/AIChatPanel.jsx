/**
 * AI Chat Panel Component
 * Provides context-aware insights about areas using Perplexity AI
 */

import React, { useState, useRef, useEffect } from 'react';

const AIChatPanel = ({ areaInfo, onClose, isCollapsed, onToggleCollapse }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentListingUrl, setCurrentListingUrl] = useState(null);
  const messagesEndRef = useRef(null);
  const prevAreaRef = useRef(null);

  // Helper to parse images from response text
  const parseImages = (text) => {
    const imageRegex = /\[IMAGE:\s*([^\]]+)\]/g;
    const listingRegex = /\[LISTING:\s*([^\]]+)\]/g;
    const images = [];
    const listings = [];
    let match;
    
    // Extract image URLs (legacy support)
    while ((match = imageRegex.exec(text)) !== null) {
      images.push(match[1].trim());
    }
    
    // Extract listing URLs
    while ((match = listingRegex.exec(text)) !== null) {
      listings.push(match[1].trim());
    }
    
    // Remove tags from text
    const cleanText = text.replace(imageRegex, '').replace(listingRegex, '').trim();
    return { text: cleanText, images, listings };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Detect area change and reset conversation
  useEffect(() => {
    const currentAreaKey = `${areaInfo?.name}-${areaInfo?.median}-${areaInfo?.level}`;
    const prevAreaKey = prevAreaRef.current;

    if (currentAreaKey !== prevAreaKey) {
      // Area changed, reset conversation
      setMessages([]);
      setInputValue('');
      setCurrentListingUrl(areaInfo?.listingUrl || null);
      prevAreaRef.current = currentAreaKey;

      if (areaInfo) {
        const isProperty = areaInfo.level === 'property';
        const isLiveProperty = areaInfo.level === 'live-property';
        
        let initialQuery;
        
        if (isLiveProperty) {
          // Live property with listing URL
          initialQuery = `I'm looking at this live property listing in ${areaInfo.areaCode || 'London'}:

Property: ${areaInfo.name}
Price: £${areaInfo.median?.toLocaleString()}
Bedrooms: ${areaInfo.bedrooms || 'Not specified'}
Bathrooms: ${areaInfo.bathrooms || 'Not specified'}
${areaInfo.propertySize ? `Size: ${areaInfo.propertySize} ${areaInfo.sizeMetric}` : ''}
Listing URL: ${areaInfo.listingUrl}

Please analyze this property and provide:
1. Is this price competitive for the area and property specs?
2. Market trends for this specific area (${areaInfo.areaCode})
3. Should I consider making an offer below asking price? How much room for negotiation?
4. Is this a good time to buy or should I wait for price drops?
5. Future price predictions for this area (next 12-24 months)
6. Investment potential and rental yield estimates
7. Environmental sustainability and energy efficiency considerations
8. Any red flags or concerns about this property or location

Be specific and reference current market data.`;
        } else {
          // Area or predicted property query
          initialQuery = `Tell me about ${areaInfo.name || 'this area'} in the UK real estate market. Include: 
1. Historical property price trends
2. Current average house prices
3. Recent market changes and growth
4. Future price predictions for 2026-2027
5. Notable features or developments in this area
6. Investment potential${isProperty ? '\n7. Environmental sustainability and energy efficiency considerations for this property type' : ''}

Context: ${areaInfo.median ? `Current median price: £${areaInfo.median?.toLocaleString()}` : ''}${areaInfo.mean ? `, mean price: £${areaInfo.mean?.toLocaleString()}` : ''}${areaInfo.sales ? `, ${areaInfo.sales} sales recorded` : ''}${isProperty && areaInfo.propertyType ? `, property type: ${areaInfo.propertyType}` : ''}`;
        }
        
        askAI(initialQuery, true);
      }
    }
  }, [areaInfo]);

  const askAI = async (question, isInitial = false) => {
    if (!question.trim() && !isInitial) return;

    // Build conversation history FIRST from existing messages (before adding the new one)
    const conversationHistory = messages
      .filter(msg => !msg.error)
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    // NOW add the new user message to display
    const userMessage = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3002/api/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          areaInfo,
          conversationHistory
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'AI request failed');
      }

      const data = await response.json();
      
      // Parse images from response
      const { text: cleanText, images, listings } = parseImages(data.answer);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: cleanText,
        images: images.length > 0 ? images : undefined,
        listings: listings.length > 0 ? listings : undefined,
        citations: data.citations,
        sources: data.sources
      }]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        error: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      // Check if user is asking for pictures/images/photos
      const lowerInput = inputValue.toLowerCase();
      const isPictureRequest = /\b(picture|photo|image|pic)s?\b/.test(lowerInput);
      
      if (isPictureRequest) {
        const userMessage = { role: 'user', content: inputValue };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');

        if (!currentListingUrl) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'No listing URL is available for this selection, so I cannot fetch images. Please click a live property point and try again.'
          }]);
          return;
        }

        // Show loading message
        const loadingMsg = {
          role: 'assistant',
          content: 'Fetching property images...',
          loading: true
        };
        setMessages(prev => [...prev, loadingMsg]);

        try {
          // Call backend scraper
          const response = await fetch('http://localhost:3002/api/scrape-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: currentListingUrl })
          });

          const data = await response.json();

          // Remove loading message and add images
          setMessages(prev => prev.filter(m => !m.loading));

          if (data.images && data.images.length > 0) {
            const aiMessage = {
              role: 'assistant',
              content: `Found ${data.images.length} property images:`,
              images: data.images
            };
            setMessages(prev => [...prev, aiMessage]);
          } else {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: 'I could not extract any images for this listing. Please try another property.'
            }]);
          }
        } catch (error) {
          console.error('Image scrape error:', error);
          setMessages(prev => prev.filter(m => !m.loading));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Image download failed. Please try another property or try again in a moment.'
          }]);
        }

        return;
      }
      
      askAI(inputValue);
    }
  };

  if (isCollapsed) {
    return (
      <div className="fixed right-4 top-4 z-30">
        <button
          onClick={onToggleCollapse}
          className="group bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl px-3 py-2 hover:border-white/20 transition-all duration-300 flex items-center gap-2"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-white/90 font-medium text-xs">AI Insights</span>
          </div>
          <svg className="w-3 h-3 text-white/60 group-hover:text-white/90 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    // To adjust height: change h-[420px] to any value (e.g., h-[450px] for taller, h-[380px] for shorter)
    <div className="fixed right-4 top-4 w-[420px] h-[420px] flex flex-col bg-black/90 backdrop-blur-xl rounded-xl shadow-2xl z-30 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex-1">
          <h3 className="text-xs font-semibold text-white">
            AI Market Insights
          </h3>
          <p className="text-[10px] text-white/40 mt-0.5 truncate">
            {areaInfo?.name || 'Area Analysis'}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onToggleCollapse}
            className="text-white/40 hover:text-white/90 transition p-1.5 hover:bg-white/5 rounded"
            title="Minimize"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/90 transition p-1.5 hover:bg-white/5 rounded"
            title="Close"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-600">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-white/10 text-white'
                  : msg.error
                    ? 'bg-red-500/20 text-red-200 border border-red-400/30'
                    : 'bg-zinc-800/80 text-white/90 border border-white/10'
              }`}
            >
              <div 
                className="text-[11px] leading-relaxed break-words"
                dangerouslySetInnerHTML={{
                  __html: msg.content
                    .replace(/\n/g, '<br/>')
                    .replace(
                      /(https?:\/\/[^\s]+)/g,
                      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline break-all">$1</a>'
                    )
                }}
              />
              
              {/* Listing URLs - clickable buttons */}
              {msg.listings && msg.listings.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[9px] text-white/40 font-medium">View Property Listings:</p>
                  {msg.listings.map((listingUrl, idx) => (
                    <a
                      key={idx}
                      href={listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-md transition group"
                    >
                      <svg className="w-3.5 h-3.5 text-white/60 group-hover:text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[10px] text-white/80 group-hover:text-white flex-1 truncate">
                        {listingUrl.includes('zoopla') ? 'Zoopla' : 
                         listingUrl.includes('rightmove') ? 'Rightmove' :
                         listingUrl.includes('onthemarket') ? 'OnTheMarket' :
                         listingUrl.includes('hamptons') ? 'Hamptons' :
                         listingUrl.includes('foxtons') ? 'Foxtons' : 'Property'} Listing #{idx + 1}
                      </span>
                      <svg className="w-3 h-3 text-white/40 group-hover:text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              )}
              
              {/* Image Gallery Card */}
              {msg.imageViewer && (
                <div className="mt-2 rounded-lg overflow-hidden border border-white/20 bg-gradient-to-br from-white/5 to-white/10">
                  <div className="p-4 space-y-3">
                    {/* Preview icon area */}
                    <div className="flex items-center justify-center h-32 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-center space-y-2">
                        <svg className="w-12 h-12 mx-auto text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-[9px] text-white/50">Property Photo Gallery</p>
                      </div>
                    </div>
                    
                    {/* Gallery button */}
                    <a
                      href={msg.imageViewer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 rounded-lg transition group"
                    >
                      <svg className="w-4 h-4 text-white/70 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="text-[11px] font-medium text-white">View All Property Photos</span>
                      <svg className="w-3.5 h-3.5 text-white/50 group-hover:text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    
                    <p className="text-[8px] text-white/30 text-center">Opens in new tab</p>
                  </div>
                </div>
              )}
              
              {/* Image thumbnails (legacy support if any direct images) */}
              {msg.images && msg.images.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {msg.images.map((imgUrl, imgIdx) => (
                    <div
                      key={imgIdx}
                      className="relative group overflow-hidden rounded-lg border border-white/10 hover:border-white/30 transition aspect-video bg-white/5"
                    >
                      <img
                        src={imgUrl}
                        alt={`Property image ${imgIdx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                        <p className="text-[8px] text-white text-center">Image {imgIdx + 1}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-[9px] text-white/30 mb-1.5 font-medium">Sources</p>
                  <div className="space-y-1">
                    {msg.citations.slice(0, 3).map((citation, i) => (
                      <a
                        key={i}
                        href={citation}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-blue-300 hover:text-blue-200 block truncate transition flex items-center gap-1 hover:underline"
                      >
                        <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {new URL(citation).hostname}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800/80 border border-white/10 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-white/50">
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[11px]">Analyzing</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 bg-black/50">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              areaInfo?.level === 'live-property' 
                ? "Try: 'Should I negotiate?' or 'Is this overpriced?'" 
                : "Ask a follow-up question..."
            }
            disabled={isLoading}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-white/8 disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-[11px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChatPanel;
