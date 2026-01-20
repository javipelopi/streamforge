/**
 * Dashboard View
 * Story 1.3: Create React GUI Shell with Routing
 * Story 4-6: Display Plex Configuration URLs
 *
 * Main dashboard displaying status overview and Plex integration URLs.
 */
import { PlexConfigSection } from '../components/dashboard/PlexConfigSection';

export function Dashboard() {
  return (
    <div data-testid="dashboard-view" className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Plex Integration Section - Story 4-6 */}
      <PlexConfigSection />
    </div>
  );
}
