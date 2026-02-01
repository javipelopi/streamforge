/**
 * Sources Components Barrel Export
 * Story 3-10: Implement Sources View with XMLTV Tab
 * Story 3-11: Implement Sources View with Xtream Tab
 * Multi-Source Stream Support: M3U and Acestream Tabs
 */

// XMLTV Components (Story 3-10)
export { XmltvSourcesTab } from './XmltvSourcesTab';
export { XmltvSourceAccordion } from './XmltvSourceAccordion';
export { XmltvSourceChannelRow } from './XmltvSourceChannelRow';

// Xtream Components (Story 3-11)
export { XtreamSourcesTab } from './XtreamSourcesTab';
export { XtreamAccountAccordion } from './XtreamAccountAccordion';
export { XtreamStreamRow } from './XtreamStreamRow';
export { XtreamLinkToChannelDialog } from './XtreamLinkToChannelDialog';

// M3U Components (Multi-Source Support)
export { M3uSourcesTab } from './M3uSourcesTab';
export { M3uSourceAccordion } from './M3uSourceAccordion';
export { AddM3uSourceDialog } from './AddM3uSourceDialog';

// Acestream Components (Multi-Source Support)
export { AcestreamSourcesTab } from './AcestreamSourcesTab';
export { AddAcestreamDialog } from './AddAcestreamDialog';

// Error Boundary (Code Review Fix #1)
export { SourcesErrorBoundary } from './SourcesErrorBoundary';
