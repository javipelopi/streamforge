import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllTags, setChannelTags } from '../../lib/api';

interface TagEditorProps {
  channelId: number;
  tags: string[];
}

export function TagEditor({ channelId, tags }: TagEditorProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allTags = [] } = useQuery({
    queryKey: ['allTags'],
    queryFn: getAllTags,
    staleTime: 30000,
  });

  const mutation = useMutation({
    mutationFn: (newTags: string[]) => setChannelTags(channelId, newTags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
      queryClient.invalidateQueries({ queryKey: ['disabledLineupChannels'] });
      queryClient.invalidateQueries({ queryKey: ['xmltvChannels'] });
      queryClient.invalidateQueries({ queryKey: ['allTags'] });
    },
  });

  const suggestions = allTags.filter(
    (t) =>
      t.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(t)
  );

  const addTag = useCallback(
    (tag: string) => {
      const normalized = tag.trim().toLowerCase();
      if (!normalized || tags.includes(normalized)) return;
      mutation.mutate([...tags, normalized]);
      setInputValue('');
      setIsAdding(false);
      setShowSuggestions(false);
    },
    [tags, mutation]
  );

  const removeTag = useCallback(
    (tag: string) => {
      mutation.mutate(tags.filter((t) => t !== tag));
    },
    [tags, mutation]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (inputValue.trim()) {
          addTag(inputValue);
        }
      } else if (e.key === 'Escape') {
        setIsAdding(false);
        setInputValue('');
        setShowSuggestions(false);
      }
    },
    [inputValue, addTag]
  );

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsAdding(false);
        setShowSuggestions(false);
        setInputValue('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="ml-0.5 hover:text-blue-600"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {isAdding ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            className="w-24 h-5 px-1 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="tag name"
          />
          {showSuggestions && inputValue && suggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 mt-1 w-32 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto">
              {suggestions.slice(0, 8).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="w-full text-left px-2 py-1 text-xs hover:bg-blue-50 text-gray-700"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(suggestion);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50"
          aria-label="Add tag"
          title="Add tag"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
