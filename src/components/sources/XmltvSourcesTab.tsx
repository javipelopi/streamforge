/**
 * XMLTV Sources Tab Component
 * Story 3-10: Implement Sources View with XMLTV Tab
 *
 * Displays XMLTV sources as expandable accordion sections.
 * Each source shows channels with lineup status and match counts.
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { getXmltvSources } from '../../lib/tauri';
import { XmltvSourceAccordion } from './XmltvSourceAccordion';
import { ROUTES } from '../../lib/routes';

export function XmltvSourcesTab() {
  const navigate = useNavigate();

  // Fetch XMLTV sources
  const {
    data: sources = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['xmltv-sources'],
    queryFn: getXmltvSources,
  });

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="xmltv-sources-tab" className="animate-pulse space-y-4">
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div data-testid="xmltv-sources-tab" className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Failed to load XMLTV sources</p>
      </div>
    );
  }

  // Empty state
  if (sources.length === 0) {
    return (
      <div data-testid="xmltv-sources-tab">
        <div data-testid="xmltv-empty-state" className="text-center py-12">
          <Radio className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <div data-testid="xmltv-empty-state-message">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No XMLTV sources configured
            </h2>
            <p className="text-gray-500 mb-6">
              Add sources in Accounts to browse channels.
            </p>
          </div>
          <button
            data-testid="go-to-accounts-button"
            onClick={() => navigate(ROUTES.ACCOUNTS)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Accounts
          </button>
        </div>
      </div>
    );
  }

  // Sources list
  return (
    <div data-testid="xmltv-sources-tab" className="space-y-4 overflow-auto h-full">
      {sources.map((source) => (
        <XmltvSourceAccordion key={source.id} source={source} />
      ))}
    </div>
  );
}
