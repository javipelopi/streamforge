/**
 * Sources View
 * Story 3-10: Implement Sources View with XMLTV Tab
 * Story 3-11: Implement Sources View with Xtream Tab
 * Multi-Source Stream Support: M3U and Acestream Tabs
 *
 * A tabbed interface for browsing channel sources:
 * - XMLTV tab: Browse EPG sources with lazy-loaded channels
 * - Xtream tab: Browse Xtream stream sources with lazy-loaded streams
 * - M3U tab: Browse M3U playlist sources
 * - Acestream tab: Manage Acestream P2P sources
 * - Matching Rules tab: Configure matching profiles with normalization rules
 */
import { useState } from 'react';
import { XmltvSourcesTab } from '../components/sources/XmltvSourcesTab';
import { XtreamSourcesTab } from '../components/sources/XtreamSourcesTab';
import { M3uSourcesTab } from '../components/sources/M3uSourcesTab';
import { AcestreamSourcesTab } from '../components/sources/AcestreamSourcesTab';
import { MatchingProfilesTab } from '../components/sources/MatchingProfilesTab';

type TabType = 'xmltv' | 'xtream' | 'm3u' | 'acestream' | 'matching';

export function Sources() {
  const [activeTab, setActiveTab] = useState<TabType>('xmltv');

  return (
    <div data-testid="sources-view" className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Sources</h1>
        <p className="text-gray-500 mt-1">
          Browse your XMLTV, Xtream, M3U, and Acestream channel sources. Configure matching rules.
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
        <button
          data-testid="m3u-tab"
          role="tab"
          aria-selected={activeTab === 'm3u'}
          aria-controls="m3u-tab-panel"
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'm3u'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('m3u')}
        >
          M3U
        </button>
        <button
          data-testid="acestream-tab"
          role="tab"
          aria-selected={activeTab === 'acestream'}
          aria-controls="acestream-tab-panel"
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'acestream'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('acestream')}
        >
          Acestream
        </button>
        <button
          data-testid="matching-tab"
          role="tab"
          aria-selected={activeTab === 'matching'}
          aria-controls="matching-tab-panel"
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'matching'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('matching')}
        >
          Matching Rules
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

      {activeTab === 'm3u' && (
        <div
          id="m3u-tab-panel"
          role="tabpanel"
          aria-labelledby="m3u-tab"
          className="flex-1 overflow-hidden"
        >
          <M3uSourcesTab />
        </div>
      )}

      {activeTab === 'acestream' && (
        <div
          id="acestream-tab-panel"
          role="tabpanel"
          aria-labelledby="acestream-tab"
          className="flex-1 overflow-hidden"
        >
          <AcestreamSourcesTab />
        </div>
      )}

      {activeTab === 'matching' && (
        <div
          id="matching-tab-panel"
          role="tabpanel"
          aria-labelledby="matching-tab"
          className="flex-1 overflow-hidden"
        >
          <MatchingProfilesTab />
        </div>
      )}
    </div>
  );
}
