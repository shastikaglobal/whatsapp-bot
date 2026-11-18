import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Sparkles, Smile, Hand, Briefcase, CheckCircle2 } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: { char: string; name: string }[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'frequent',
    name: 'Popular & Reactions',
    icon: '🌟',
    emojis: [
      { char: '👍', name: 'thumbs up ok agree' },
      { char: '🤝', name: 'handshake deal partner' },
      { char: '🙏', name: 'folded hands thank you please vanakkam' },
      { char: '😊', name: 'smiling blush happy' },
      { char: '❤️', name: 'heart love' },
      { char: '😂', name: 'joy laugh tears' },
      { char: '👏', name: 'clapping applause' },
      { char: '✨', name: 'sparkles star' },
      { char: '🔥', name: 'fire hot fast' },
      { char: '💯', name: 'hundred perfect quality' },
      { char: '✅', name: 'check verified done' },
      { char: '📞', name: 'call phone speak' }
    ]
  },
  {
    id: 'produce',
    name: 'Agri & Export Produce',
    icon: '🥥',
    emojis: [
      { char: '🥥', name: 'coconut mature semi husked' },
      { char: '🍌', name: 'banana cavendish fresh' },
      { char: '🍉', name: 'watermelon melon fruit' },
      { char: '🎃', name: 'pumpkin vegetable' },
      { char: '🥒', name: 'cucumber gherkin' },
      { char: '🥭', name: 'mango alphonso fruit' },
      { char: '🍍', name: 'pineapple fruit' },
      { char: '🥑', name: 'avocado' },
      { char: '🍋', name: 'lemon lime' },
      { char: '🌾', name: 'grain rice wheat agriculture' },
      { char: '🌱', name: 'seedling plant fresh organic' },
      { char: '🌴', name: 'palm tree coconut farm' },
      { char: '📦', name: 'package box carton carton packing' },
      { char: '🚢', name: 'ship vessel container cif fob sea freight' },
      { char: '✈️', name: 'airplane air freight cargo' },
      { char: '🚛', name: 'truck lorry transport delivery' }
    ]
  },
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: '😀',
    emojis: [
      { char: '😀', name: 'grinning face smile' },
      { char: '😃', name: 'smiley happy' },
      { char: '😄', name: 'smile happy joy' },
      { char: '😁', name: 'beam grin' },
      { char: '😆', name: 'laugh closed eyes' },
      { char: '😅', name: 'sweat smile relief' },
      { char: '🤣', name: 'rofl rolling floor laughing' },
      { char: '😂', name: 'joy crying laughing' },
      { char: '🙂', name: 'slight smile' },
      { char: '🙃', name: 'upside down' },
      { char: '😉', name: 'wink' },
      { char: '😊', name: 'blush warm' },
      { char: '😇', name: 'halo angel innocent' },
      { char: '🥰', name: 'love hearts smile' },
      { char: '😍', name: 'heart eyes love' },
      { char: '🤩', name: 'star eyes excited' },
      { char: '😘', name: 'blow kiss' },
      { char: '😋', name: 'yum delicious' },
      { char: '😜', name: 'wink tongue' },
      { char: '🤪', name: 'zany goofy' },
      { char: '🤗', name: 'hugging open hands' },
      { char: '🤔', name: 'thinking question idea' },
      { char: '🤫', name: 'shushing secret' },
      { char: '🤭', name: 'giggle hand over mouth' },
      { char: '🥳', name: 'party celebrate' },
      { char: '😎', name: 'sunglasses cool' },
      { char: '😌', name: 'relieved calm' }
    ]
  },
  {
    id: 'gestures',
    name: 'Hands & People',
    icon: '🖐️',
    emojis: [
      { char: '👍', name: 'thumbs up approve yes ok' },
      { char: '👎', name: 'thumbs down no' },
      { char: '👏', name: 'clap applause good job' },
      { char: '🤝', name: 'handshake deal contract partner agree' },
      { char: '🙏', name: 'folded hands pray thank you namaste vanakkam' },
      { char: '✌️', name: 'peace victory' },
      { char: '🤞', name: 'crossed fingers hope luck' },
      { char: '🖐️', name: 'hand splayed five' },
      { char: '✋', name: 'raised hand stop' },
      { char: '👌', name: 'ok hand perfect' },
      { char: '👈', name: 'point left' },
      { char: '👉', name: 'point right this' },
      { char: '👆', name: 'point up above' },
      { char: '👇', name: 'point down below link' },
      { char: '✍️', name: 'writing hand note signing' },
      { char: '💪', name: 'muscle strong quality' },
      { char: '👋', name: 'wave hello bye' },
      { char: '🫡', name: 'salute respect noted' }
    ]
  },
  {
    id: 'business',
    name: 'Business & Trade',
    icon: '💼',
    emojis: [
      { char: '📞', name: 'telephone call contact' },
      { char: '📱', name: 'mobile phone whatsapp' },
      { char: '💬', name: 'speech bubble chat message' },
      { char: '✉️', name: 'envelope email quotation' },
      { char: '💼', name: 'briefcase business professional bde' },
      { char: '📋', name: 'clipboard document quotation rfq specs' },
      { char: '📊', name: 'bar chart analytics report' },
      { char: '📈', name: 'chart upward growth sales' },
      { char: '💰', name: 'money bag price cost quote' },
      { char: '💵', name: 'dollar currency payment cash' },
      { char: '🏷️', name: 'label tag price moq' },
      { char: '🏢', name: 'office building company headquarters' },
      { char: '🏬', name: 'department store warehouse' },
      { char: '📍', name: 'pin location address port origin destination' },
      { char: '⏰', name: 'clock time delivery schedule' },
      { char: '⏳', name: 'hourglass pending processing' },
      { char: '🧾', name: 'receipt invoice proforma' }
    ]
  },
  {
    id: 'symbols',
    name: 'Status & Symbols',
    icon: '⚡',
    emojis: [
      { char: '✅', name: 'check green verified confirm ok' },
      { char: '❌', name: 'cross cancel reject no' },
      { char: '⚠️', name: 'warning alert attention' },
      { char: '❓', name: 'question mark enquiry' },
      { char: '❗', name: 'exclamation important urgent' },
      { char: '💡', name: 'lightbulb idea tip' },
      { char: '🎯', name: 'target goal accuracy' },
      { char: '⭐', name: 'star favorite rating' },
      { char: '🌟', name: 'glowing star premium' },
      { char: '💯', name: 'hundred percent best' },
      { char: '🆗', name: 'ok button confirm' },
      { char: '🆒', name: 'cool' },
      { char: '🆕', name: 'new arrival fresh' },
      { char: '🟢', name: 'green circle active available' },
      { char: '🔴', name: 'red circle offline closed' },
      { char: '🟡', name: 'yellow circle waiting' }
    ]
  }
];

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeTab, setActiveTab] = useState('frequent');
  const [search, setSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Filter emojis if searching
  const filteredEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap(cat => cat.emojis).filter(e => 
        e.name.toLowerCase().includes(search.toLowerCase().trim()) || e.char.includes(search.trim())
      )
    : null;

  return (
    <div 
      ref={pickerRef}
      className="absolute bottom-full mb-3 left-0 sm:left-2 w-80 sm:w-96 bg-white rounded-2xl shadow-[0_15px_45px_rgba(0,0,0,0.25),0_0_15px_rgba(0,0,0,0.06)] border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[380px] animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Search Header */}
      <div className="p-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search emojis (e.g. coconut, deal, hand)..."
            className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            autoFocus
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
          title="Close emoji picker"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs (shown when not searching) */}
      {!search.trim() && (
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 bg-slate-50/70 overflow-x-auto text-xs shrink-0">
          {EMOJI_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-sm transition-all flex items-center gap-1 ${
                activeTab === cat.id 
                  ? 'bg-emerald-100/70 text-emerald-800 font-bold shadow-2xs' 
                  : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
              }`}
              title={cat.name}
            >
              <span>{cat.icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid Area */}
      <div className="flex-1 overflow-y-auto p-3 max-h-64 divide-y divide-slate-100">
        {filteredEmojis ? (
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Search Results ({filteredEmojis.length})
            </div>
            {filteredEmojis.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No matching emojis found for "{search}"
              </div>
            ) : (
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
                {filteredEmojis.map((e, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelect(e.char);
                    }}
                    className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-emerald-50 hover:scale-125 transition-all select-none cursor-pointer"
                    title={e.name}
                  >
                    {e.char}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          EMOJI_CATEGORIES.filter(cat => cat.id === activeTab).map(cat => (
            <div key={cat.id}>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </div>
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
                {cat.emojis.map((e, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelect(e.char);
                    }}
                    className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-emerald-50 hover:scale-125 transition-all select-none cursor-pointer"
                    title={e.name}
                  >
                    {e.char}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Click any emoji to insert</span>
        <span className="font-semibold text-emerald-600">WhatsApp Ready</span>
      </div>
    </div>
  );
}
