import { useState, useRef, useEffect, useCallback } from 'react';

interface AutocompleteProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
}

export default function Autocomplete({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  error,
  className = '',
  disabled,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filter = useCallback(
    (text: string) => {
      if (!text.trim()) return suggestions;
      const lower = text.toLocaleLowerCase('tr');
      return suggestions.filter((s) => s.toLocaleLowerCase('tr').includes(lower));
    },
    [suggestions]
  );

  useEffect(() => {
    setFiltered(filter(value));
  }, [value, filter]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i < filtered.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : filtered.length - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      selectItem(filtered[highlightIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function selectItem(item: string) {
    onChange(item);
    setOpen(false);
    setHighlightIndex(-1);
  }

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      )}
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
          disabled:bg-slate-100 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : ''}`}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlightIndex(-1);
        }}
        onFocus={() => {
          setFiltered(filter(value));
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg"
        >
          {filtered.map((item, idx) => (
            <li
              key={item}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                idx === highlightIndex
                  ? 'bg-teal-50 text-teal-800'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(item);
              }}
              onMouseEnter={() => setHighlightIndex(idx)}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
