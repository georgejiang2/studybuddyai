import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './Autocomplete.module.css';

interface Props {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  maxResults?: number;
}

export default function Autocomplete({
  options,
  value,
  onChange,
  placeholder,
  id,
  required,
  maxResults = 8,
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useCallback(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return options
      .filter((o) => o.toLowerCase().includes(q))
      .slice(0, maxResults);
  }, [query, options, maxResults]);

  const results = open ? filtered() : [];

  const handleSelect = (val: string) => {
    setQuery(val);
    onChange(val);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    onChange(val);
    setOpen(true);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        id={id}
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className={styles.dropdown} ref={listRef}>
          {results.map((item, i) => (
            <li
              key={item}
              className={`${styles.item} ${i === activeIndex ? styles.itemActive : ''}`}
              onMouseDown={() => handleSelect(item)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {highlightMatch(item, query)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <strong>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}
