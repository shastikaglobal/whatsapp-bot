import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Smile, Flower2, Coffee, Car, Lightbulb, Percent, Flag, Sticker } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  emojis: string[];
}

const CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & People',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '🥹', '😅', '😂', '🤣', '🥲', '☺️', '😊',
      '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋',
      '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢', '🤫', '🤔', '🫡', '🤐',
      '🤨', '😐', '😑', '😶', '🫥', '😶‍🌫️', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥',
      '🫨', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
      '🥶', '🥴', '😵', '😵‍💫', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕',
      '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥',
      '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
      '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽',
      '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '🫵', '👌', '🤌',
      '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇',
      '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲',
      '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦵', '🦶', '👂', '🦻', '👃', '🧠',
      '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '🫦', '👤', '👥', '🫂'
    ]
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
      '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤',
      '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱',
      '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️',
      '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡',
      '🐠', '🐟', '🐬', '🐳', '🐋', '鲨', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧',
      '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄',
      '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐈', '🐈‍⬛',
      '🪶', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨',
      '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔', '🐾', '🌵', '🎄', '🌲',
      '🌳', '🌴', '🪵', '🌱', '🌿', '☘️', '🍀', '🎍', '🪴', '🎋', '🍃', '🍂',
      '🍁', '🍄', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞',
      '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔',
      '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐️', '🌟', '✨', '⚡️', '☄️', '💥',
      '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅️', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️',
      '🌨️', '❄️', '☃️', '⛄️', '🌬️', '💨', '💧', '💦', '🫧', '☔️', '☂️', '🌊'
    ]
  },
  {
    id: 'food',
    name: 'Food & Drink',
    emojis: [
      '🥥', '🍌', '🍉', '🍇', '🍈', '🍊', '🍋', '🍍', '🥭', '🍎', '🍏', '🍐',
      '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥑', '🍆', '🥔', '🥕', '🌽',
      '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🥜', '🫘', '🌰', '🍞', '🥐',
      '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔',
      '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘',
      '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚',
      '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠',
      '🥡', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬',
      '🍭', '🍮', '🍯', '🍼', '🥛', '☕️', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸',
      '🍹', '🍺', '🍻', '🥂', '🥃', '🫗', '🥤', '🧋', '🧃', '🧉', '🧊', '🍽️'
    ]
  },
  {
    id: 'activities',
    name: 'Activities',
    emojis: [
      '⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓',
      '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳️', '🪁', '🏹', '🎣', '🤿',
      '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂',
      '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽',
      '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️',
      '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹',
      '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳',
      '🎮', '🎰', '🧩'
    ]
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚',
      '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔',
      '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅',
      '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️',
      '🚀', '🛸', '🚁', '🛶', '⛵️', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓️', '🛟',
      '⛽️', '🚧', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡',
      '🎢', '🎠', '⛲️', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🏕️', '⛺️',
      '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬',
      '🏭', '💒', '⛪️', '🕌', '🛕', '🕍', '⛩️', '🕋'
    ]
  },
  {
    id: 'objects',
    name: 'Objects',
    emojis: [
      '⌚️', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '💽', '💾', '💿', '📀',
      '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻',
      '🎙️', '⏱️', '⏲️', '⏰', '🕰️', '⌛️', '⏳', '📡', '🔋', '🪫', '🔌', '💡',
      '🔦', '🕯️', '🪔', '🧯', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳',
      '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '🛠️', '⛏️', '🪚', '🔩', '⚙️',
      '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🔮',
      '🧿', '🪬', '💈', '⚗️', '🔭', '🔬', '🩹', '🩺', '💊', '💉', '🩸', '🌡️',
      '🧹', '🧺', '🧻', '🧼', '🪥', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛍️',
      '🛒', '🎁', '🎈', '🎉', '🎊', '✉️', '📩', '📨', '📧', '💌', '📦', '🏷️',
      '📪', '📫', '📬', '📭', '📮', '📜', '📃', '📄', '📑', '🧾', '📊', '📈',
      '📉', '🗒️', '🗓️', '📅', '📆', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓',
      '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🔗', '📎', '🖇️', '📐', '📏',
      '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '📝', '✏️', '🔍', '🔎', '🔒', '🔓'
    ]
  },
  {
    id: 'symbols',
    name: 'Symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️',
      '✡️', '☯️', '☦️', '🆔', '♾️', '☢️', '☣️', '📴', '📳', '✴️', '🆚', '💮',
      '🉐', '㊙️', '㊗️', '🈴', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕️',
      '🛑', '⛔️', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🔞', '📵',
      '❗️', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '⚠️', '🚸', '🔱', '⚜️',
      '🔰', '♻️', '✅', '🈯️', '❇️', '✳️', '❎', '🌐', '💠', '💤', '🏧', '🚾',
      '♿️', '🅿️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '📶',
      '🈁', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣',
      '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '▶️', '⏸️',
      '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '◀️', '🔼', '🔽', '➡️', '⬅️',
      '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️',
      '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '🟰',
      '💲', '💱', '™️', '©️', '®️', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢',
      '🔵', '🟣', '⚫️', '⚪️', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '▪️',
      '▫️', '◾️', '◽️', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛️',
      '⬜️', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭'
    ]
  },
  {
    id: 'flags',
    name: 'Flags',
    emojis: [
      '🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇮🇳', '🇺🇸', '🇦🇪', '🇸🇦', '🇸🇬',
      '🇲🇾', '🇬🇧', '🇨🇦', '🇦🇺', '🇩🇪', '🇫🇷', '🇯🇵', '🇨🇳', '🇧🇷', '🇿🇦', '🇮🇩', '🇷🇺',
      '🇰🇷', '🇮🇹', '🇪🇸', '🇹🇷', '🇳🇱', '🇻🇳', '🇧🇩', '🇵🇰', '🇱🇰', '🇳🇵', '🇴🇲', '🇶🇦',
      '🇰🇼', '🇧🇭', '🇪🇬', '🇲🇽', '🇳🇿', '🇿🇼'
    ]
  }
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<string>('smileys');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  // Scroll to section when category icon clicked
  const handleCategoryClick = (catId: string) => {
    setActiveCategory(catId);
    setSearchQuery('');
    const target = sectionRefs.current[catId];
    if (target && scrollContainerRef.current) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Filter emojis when search query is entered
  const filteredCategories = searchQuery.trim()
    ? CATEGORIES.map(cat => ({
        ...cat,
        emojis: cat.emojis.filter(emoji => emoji.includes(searchQuery.trim()))
      })).filter(cat => cat.emojis.length > 0)
    : CATEGORIES;

  // Top navigation category icon renderer
  const renderCategoryIcon = (id: string) => {
    const iconClass = "w-5 h-5";
    switch (id) {
      case 'smileys':
        return <Smile className={iconClass} />;
      case 'animals':
        return <Flower2 className={iconClass} />;
      case 'food':
        return <Coffee className={iconClass} />;
      case 'activities':
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M4.93 4.93a10 10 0 0 0 14.14 14.14" />
            <path d="M19.07 4.93a10 10 0 0 0-14.14 14.14" />
            <path d="M2 12h20" />
            <path d="M12 2v20" />
          </svg>
        );
      case 'travel':
        return <Car className={iconClass} />;
      case 'objects':
        return <Lightbulb className={iconClass} />;
      case 'symbols':
        return <Percent className={iconClass} />;
      case 'flags':
        return <Flag className={iconClass} />;
      default:
        return <Smile className={iconClass} />;
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-3 left-0 w-[420px] max-w-[calc(100vw-32px)] sm:w-[460px] bg-white rounded-2xl shadow-2xl border border-[#e9edef] z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 select-none text-slate-800"
      style={{ height: '430px' }}
      onClick={e => e.stopPropagation()}
    >
      {/* 1. Top Category Bar (Exact WhatsApp Web style with green active indicator) */}
      <div className="grid grid-cols-8 border-b border-[#e9edef] px-2 pt-1 shrink-0 bg-white">
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.id && !searchQuery;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryClick(cat.id)}
              className={`relative py-3 flex items-center justify-center transition-colors cursor-pointer ${
                isActive ? 'text-[#00a884]' : 'text-[#54656f] hover:text-[#111b21]'
              }`}
              title={cat.name}
            >
              {renderCategoryIcon(cat.id)}
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-[#00a884] rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Search Bar (Exact WhatsApp Web rounded pill with green border) */}
      <div className="px-4 pt-3 pb-2 shrink-0 bg-white">
        <div className="relative flex items-center border-2 border-[#00a884] rounded-full px-3.5 py-1.5 bg-white shadow-2xs">
          <Search className="w-4 h-4 text-[#54656f] shrink-0 mr-2.5" />
          <input
            type="text"
            placeholder="Search emoji"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[#111b21] placeholder-[#8696a0] focus:outline-none"
            autoFocus={false}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[#54656f] hover:text-[#111b21] p-0.5 ml-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Scrollable Emoji Grid Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-4 custom-scrollbar bg-white"
      >
        {filteredCategories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8696a0]">
            <p className="text-sm font-medium">No emoji found</p>
          </div>
        ) : (
          filteredCategories.map(cat => (
            <div
              key={cat.id}
              ref={el => (sectionRefs.current[cat.id] = el)}
              className="space-y-1.5"
            >
              <h4 className="text-xs font-semibold text-[#54656f] tracking-wide px-1 pt-1">
                {cat.name}
              </h4>
              <div className="grid grid-cols-10 sm:grid-cols-11 md:grid-cols-12 gap-1">
                {cat.emojis.map((emoji, index) => (
                  <button
                    key={`${cat.id}-${index}`}
                    type="button"
                    onClick={() => onSelect(emoji)}
                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[22px] leading-none hover:bg-[#f0f2f5] active:scale-90 rounded-lg cursor-pointer transition-all duration-75 select-none"
                    title={cat.name}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. Bottom WhatsApp Switcher Pill [ 😀 | GIF | 🗂️ ] */}
      <div className="border-t border-[#e9edef] bg-white py-2 flex items-center justify-center shrink-0">
        <div className="inline-flex items-center rounded-full bg-[#f0f2f5] p-0.5 border border-[#e9edef]">
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={`flex items-center justify-center px-4 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'emoji'
                ? 'bg-white text-[#111b21] shadow-2xs font-bold'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            <Smile className="w-4 h-4 text-[#111b21]" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gif')}
            className={`flex items-center justify-center px-4 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'gif'
                ? 'bg-white text-[#111b21] shadow-2xs font-bold'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            <span className="text-[11px] font-bold">GIF</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sticker')}
            className={`flex items-center justify-center px-4 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'sticker'
                ? 'bg-white text-[#111b21] shadow-2xs font-bold'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            <Sticker className="w-4 h-4 text-[#54656f]" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;
