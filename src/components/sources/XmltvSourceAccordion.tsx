/**
 * XMLTV Source Accordion Component
 * Story 3-10: Implement Sources View with XMLTV Tab
 *
 * Expandable accordion section for an XMLTV source.
 * Lazy-loads channels only when expanded.
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2, Search, X } from 'lucide-react';
import {
  getXmltvChannelsForSource,
  getEpgStats,
  type XmltvSource,
} from '../../lib/tauri';
import { XmltvSourceChannelRow } from './XmltvSourceChannelRow';
import {
  PaginationControls,
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from '../ui/PaginationControls';

interface XmltvSourceAccordionProps {
  source: XmltvSource;
}

export function XmltvSourceAccordion({ source }: XmltvSourceAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[1]); // Default: 50
  const [searchQuery, setSearchQuery] = useState('');
  const contentId = `xmltv-source-channels-${source.id}`;
  const queryClient = useQueryClient();

  // Fetch EPG stats for channel count
  const { data: epgStats } = useQuery({
    queryKey: ['epg-stats', source.id],
    queryFn: () => getEpgStats(source.id),
    staleTime: 60000, // 1 minute
  });

  // Lazy-load channels only when expanded
  const {
    data: channels = [],
    isLoading: channelsLoading,
    error: channelsError,
  } = useQuery({
    queryKey: ['xmltv-source-channels', source.id],
    queryFn: () => getXmltvChannelsForSource(source.id),
    enabled: isExpanded,
    staleTime: 30000, // 30 seconds
  });

  const channelCount = epgStats?.channelCount ?? channels.length;

  // Filter channels based on search query
  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const query = searchQuery.toLowerCase();
    return channels.filter(
      (channel) =>
        channel.displayName.toLowerCase().includes(query) ||
        channel.channelId.toLowerCase().includes(query)
    );
  }, [channels, searchQuery]);

  // Paginate filtered channels
  const paginatedChannels = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredChannels.slice(startIndex, startIndex + pageSize);
  }, [filteredChannels, currentPage, pageSize]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      data-testid={`xmltv-source-accordion-${source.id}`}
      className="border border-gray-200 rounded-lg overflow-hidden"
    >
      {/* Accordion Header */}
      <button
        data-testid={`xmltv-source-header-${source.id}`}
        type="button"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
          <div>
            <span className="font-medium text-gray-900">{source.name}</span>
            <span className="ml-3 text-sm text-gray-500">
              {channelCount} channel{channelCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {source.lastRefresh && (
          <span className="text-xs text-gray-400">
            Last refresh: {new Date(source.lastRefresh).toLocaleDateString()}
          </span>
        )}
      </button>

      {/* Accordion Content */}
      {isExpanded && (
        <div
          id={contentId}
          data-testid={`xmltv-source-channels-${source.id}`}
          className="border-t border-gray-200"
        >
          {/* Loading state */}
          {channelsLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">Loading channels...</span>
            </div>
          )}

          {/* Error state */}
          {channelsError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-700 mb-2">Failed to load channels</p>
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['xmltv-source-channels', source.id] });
                }}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Channels list with search and pagination */}
          {!channelsLoading && !channelsError && channels.length > 0 && (
            <>
              {/* Search input */}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search channels..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-10 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => handleSearchChange('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <PaginationControls
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={filteredChannels.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />

              {/* No search results */}
              {filteredChannels.length === 0 && searchQuery && (
                <div className="p-4 text-center text-gray-500">
                  No channels match "{searchQuery}"
                </div>
              )}

              {/* Channel rows */}
              {filteredChannels.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {paginatedChannels.map((channel) => (
                    <XmltvSourceChannelRow
                      key={channel.id}
                      channel={channel}
                      sourceId={source.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Empty channels */}
          {!channelsLoading && !channelsError && channels.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No channels in this source
            </div>
          )}
        </div>
      )}
    </div>
  );
}
