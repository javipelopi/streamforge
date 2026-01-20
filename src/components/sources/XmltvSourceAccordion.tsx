/**
 * XMLTV Source Accordion Component
 * Story 3-10: Implement Sources View with XMLTV Tab
 *
 * Expandable accordion section for an XMLTV source.
 * Lazy-loads channels only when expanded.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import {
  getXmltvChannelsForSource,
  getEpgStats,
  type XmltvSource,
} from '../../lib/tauri';
import { XmltvSourceChannelRow } from './XmltvSourceChannelRow';

interface XmltvSourceAccordionProps {
  source: XmltvSource;
}

export function XmltvSourceAccordion({ source }: XmltvSourceAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = `xmltv-source-channels-${source.id}`;

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
            <div className="p-4 bg-red-50 text-red-700">
              Failed to load channels
            </div>
          )}

          {/* Channels list */}
          {!channelsLoading && !channelsError && channels.length > 0 && (
            <div className="divide-y divide-gray-100">
              {channels.map((channel) => (
                <XmltvSourceChannelRow
                  key={channel.id}
                  channel={channel}
                  sourceId={source.id}
                />
              ))}
            </div>
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
