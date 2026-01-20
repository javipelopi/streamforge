/**
 * Sources View
 * Story 3-10: Implement Sources View with XMLTV Tab
 * Story 3-11: Implement Sources View with Xtream Tab
 *
 * A tabbed interface for browsing channel sources:
 * - XMLTV tab: Browse EPG sources with lazy-loaded channels
 * - Xtream tab: Browse Xtream stream sources with lazy-loaded streams
 */
import { useState } from 'react';
import { XmltvSourcesTab } from '../components/sources/XmltvSourcesTab';
import { XtreamSourcesTab } from '../components/sources/XtreamSourcesTab';

type TabType = 'xmltv' | 'xtream';

export function Sources() {
  const [activeTab, setActiveTab] = useState<TabType>('xmltv');

  return (
    <div data-testid="sources-view" className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Sources</h1>
        <p className="text-gray-500 mt-1">
          Browse your XMLTV and Xtream channel sources
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-4" role="tablist" aria-label="Source types">
        <button
          data-testid="xmltv-tab"
          role="tab"
          aria-selected={activeTab === 'xmltv'}
          aria-controls="xmltv-tab-panel"
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'xmltv'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('xmltv')}
        >
          XMLTV
        </button>
        <button
          data-testid="xtream-tab"
          role="tab"
          aria-selected={activeTab === 'xtream'}
          aria-controls="xtream-tab-panel"
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'xtream'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('xtream')}
        >
          Xtream
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'xmltv' && (
        <div
          id="xmltv-tab-panel"
          role="tabpanel"
          aria-labelledby="xmltv-tab"
          className="flex-1 overflow-hidden"
        >
          <XmltvSourcesTab />
        </div>
      )}

      {activeTab === 'xtream' && (
        <div
          id="xtream-tab-panel"
          role="tabpanel"
          aria-labelledby="xtream-tab"
          className="flex-1 overflow-hidden"
        >
          <XtreamSourcesTab />
        </div>
      )}
    </div>
  );
}
