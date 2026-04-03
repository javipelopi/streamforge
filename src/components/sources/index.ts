/**
 * Sources Components Barrel Export
 * Story 3-10: Implement Sources View with XMLTV Tab
 * Story 3-11: Implement Sources View with Xtream Tab
 * Multi-Source Stream Support: M3U and Acestream Tabs
 * Sources-Centric UX Unification: Unified dialogs and shared components
 */

// XMLTV Components (Story 3-10)
export { XmltvSourcesTab } from './XmltvSourcesTab';
export { XmltvSourceAccordion } from './XmltvSourceAccordion';
export { XmltvSourceChannelRow } from './XmltvSourceChannelRow';
export { XmltvSourceDialog } from './XmltvSourceDialog';

// Xtream Components (Story 3-11)
export { XtreamSourcesTab } from './XtreamSourcesTab';
export { XtreamAccountAccordion } from './XtreamAccountAccordion';
export { XtreamStreamRow } from './XtreamStreamRow';
export { XtreamAccountDialog } from './XtreamAccountDialog';

// M3U Components (Multi-Source Support)
export { M3uSourcesTab } from './M3uSourcesTab';
export { M3uSourceAccordion } from './M3uSourceAccordion';
export { M3uChannelRow } from './M3uChannelRow';
export { M3uSourceDialog } from './M3uSourceDialog';

// Acestream Components (Multi-Source Support)
export { AcestreamSourcesTab } from './AcestreamSourcesTab';
export { AcestreamSourceRow } from './AcestreamSourceRow';
export { AcestreamSourceDialog } from './AcestreamSourceDialog';

// Matching Profile Components
export { MatchingProfilesTab } from './MatchingProfilesTab';
export { MatchingProfileDialog } from './MatchingProfileDialog';
export { MatchingRuleEditor } from './MatchingRuleEditor';
export { MatchPreview } from './MatchPreview';

// Shared Components
export { LinkToXmltvChannelDialog } from './LinkToXmltvChannelDialog';
export * from './shared';

// Error Boundary (Code Review Fix #1)
export { SourcesErrorBoundary } from './SourcesErrorBoundary';
