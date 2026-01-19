import { test, expect } from '@playwright/experimental-ct-react';
import { ChannelsList } from '../../src/components/channels/ChannelsList';
import { createChannels, createChannel } from '../support/factories/channel.factory';

/**
 * Component Tests for ChannelsList Component
 *
 * Tests the ChannelsList UI component in isolation using Playwright Component Testing.
 * Verifies rendering, quality badges, category display, and virtualization.
 *
 * These tests run in a controlled browser environment without the full Tauri backend.
 */

test.describe('ChannelsList Component', () => {
  test('should render empty state when no channels provided', async ({ mount }) => {
    // GIVEN: No channels available
    const component = await mount(
      <ChannelsList accountId={1} channels={[]} isLoading={false} />
    );

    // THEN: Empty state message is shown
    await expect(component.getByText(/no channels found/i)).toBeVisible();
  });

  test('should render loading state when isLoading is true', async ({ mount }) => {
    // GIVEN: Channels are loading
    const component = await mount(
      <ChannelsList accountId={1} channels={[]} isLoading={true} />
    );

    // THEN: Loading indicator is shown
    await expect(component.getByText(/loading/i)).toBeVisible();
  });

  test('should display channel name and category', async ({ mount }) => {
    // GIVEN: Channel with name and category
    const channel = createChannel({
      name: 'ESPN Sports HD',
      categoryName: 'Sports',
    });

    const component = await mount(
      <ChannelsList accountId={1} channels={[channel]} isLoading={false} />
    );

    // THEN: Channel name is displayed
    await expect(component.getByText('ESPN Sports HD')).toBeVisible();

    // AND: Category name is displayed
    await expect(component.getByText('Sports')).toBeVisible();
  });

  test('should display channel logo when stream_icon is provided', async ({ mount }) => {
    // GIVEN: Channel with logo URL
    const channel = createChannel({
      name: 'CNN News',
      streamIcon: 'http://example.com/logos/cnn.png',
    });

    const component = await mount(
      <ChannelsList accountId={1} channels={[channel]} isLoading={false} />
    );

    // THEN: Logo image is rendered
    const logo = component.locator('img[alt=""]').first();
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', 'http://example.com/logos/cnn.png');
  });

  test('should not render logo when stream_icon is null', async ({ mount }) => {
    // GIVEN: Channel without logo
    const channel = createChannel({
      name: 'Local Channel',
      streamIcon: null,
    });

    const component = await mount(
      <ChannelsList accountId={1} channels={[channel]} isLoading={false} />
    );

    // THEN: No logo image is rendered
    const logos = component.locator('img');
    await expect(logos).toHaveCount(0);
  });

  test('should display HD quality badge', async ({ mount }) => {
    // GIVEN: Channel with HD quality
    const channel = createChannel({
      name: 'HBO HD',
      qualities: ['HD'],
    });

    const component = await mount(
      <ChannelsList accountId={1} channels={[channel]} isLoading={false} />
    );

    // THEN: HD badge is displayed with correct styling
    const badge = component.getByText('HD');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-green-100/);
    await expect(badge).toHaveClass(/text-green-800/);
  });

  test('should display SD quality badge', async ({ mount }) => {
    // GIVEN: Channel with SD quality
    const channel = createChannel({
      name: 'Local SD',
      qualities: ['SD'],
    });

    const component = await mount(
      <ChannelsList accountId={1} channels={[channel]} isLoading={false} />
    );

    // THEN: SD badge is displayed with gray styling
    const badge = component.getByText('SD');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-gray-100/);
    await expect(badge).toHaveClass(/text-gray-800/);
  });

  test('should display 4K quality badge', async ({ mount }) => {
    // GIVEN: Channel with 4K quality
    const channel = createChannel({
      name: 'Premium 4K',
      qualities: ['4K'],
    });

    const component = await mount(
      <ChannelsList accountId={1} channels={[channel]} isLoading={false} />
    );

    // THEN: 4K badge is displayed with purple styling
    const badge = component.getByText('4K');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-purple-100/);
    await expect(badge).toHaveClass(/text-purple-800/);
  });

  test('should display FHD quality badge', async ({ mount }) => {
    // GIVEN: Channel with FHD quality
    const channel = createChannel({
      name: 'Movies FHD',
      qualities: ['FHD'],
    });

    const component = await mount(
      <ChannelsList accountId={1} channels={[channel]} isLoading={false} />
    );

    // THEN: FHD badge is displayed with blue styling
    const badge = component.getByText('FHD');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-blue-100/);
    await expect(badge).toHaveClass(/text-blue-800/);
  });

  test('should display multiple quality badges for channel with multiple qualities', async ({ mount }) => {
    // GIVEN: Channel with multiple qualities
    const channel = createChannel({
      name: 'Multi Quality Channel',
      qualities: ['HD', 'SD'],
    });

    const component = await mount(
      <ChannelsList accountId={1} channels={[channel]} isLoading={false} />
    );

    // THEN: Both badges are displayed
    await expect(component.getByText('HD')).toBeVisible();
    await expect(component.getByText('SD')).toBeVisible();
  });

  test('should render multiple channels in list', async ({ mount }) => {
    // GIVEN: Multiple channels
    const channels = createChannels(5);

    const component = await mount(
      <ChannelsList accountId={1} channels={channels} isLoading={false} />
    );

    // THEN: All channels are rendered
    for (const channel of channels) {
      await expect(component.getByText(channel.name)).toBeVisible();
    }
  });

  test('should use TanStack Virtual for performance with large lists', async ({ mount }) => {
    // GIVEN: Large channel list (100 channels)
    const channels = createChannels(100);

    const component = await mount(
      <ChannelsList accountId={1} channels={channels} isLoading={false} />
    );

    // THEN: Component renders without lag
    // Expected: Only visible rows are in DOM (virtualization)
    // Expected: Parent container has fixed height and scroll
    const container = component.locator('[data-testid="channels-list-container"]');
    await expect(container).toBeVisible();

    // Verify virtualization is working (not all 100 items rendered at once)
    const renderedItems = component.locator('[data-testid="channel-list-item"]');
    const count = await renderedItems.count();

    // Should render only visible items (typically 10-20), not all 100
    expect(count).toBeLessThan(50);
  });

  test('should render channels with all data fields present', async ({ mount }) => {
    // GIVEN: Channel with complete data
    const channel = createChannel({
      id: 123,
      streamId: 12345,
      name: 'Complete Channel HD',
      streamIcon: 'http://example.com/logo.png',
      categoryId: 5,
      categoryName: 'Entertainment',
      qualities: ['HD', 'SD'],
      epgChannelId: 'channel.us',
      tvArchive: true,
      tvArchiveDuration: 7,
    });

    const component = await mount(
      <ChannelsList accountId={1} channels={[channel]} isLoading={false} />
    );

    // THEN: Name is displayed
    await expect(component.getByText('Complete Channel HD')).toBeVisible();

    // AND: Category is displayed
    await expect(component.getByText('Entertainment')).toBeVisible();

    // AND: Logo is displayed
    const logo = component.locator('img').first();
    await expect(logo).toBeVisible();

    // AND: Quality badges are displayed
    await expect(component.getByText('HD')).toBeVisible();
    await expect(component.getByText('SD')).toBeVisible();
  });

  test('should handle channels with null category gracefully', async ({ mount }) => {
    // GIVEN: Channel without category
    const channel = createChannel({
      name: 'Uncategorized Channel',
      categoryId: null,
      categoryName: null,
    });

    const component = await mount(
      <ChannelsList accountId={1} channels={[channel]} isLoading={false} />
    );

    // THEN: Channel name is displayed
    await expect(component.getByText('Uncategorized Channel')).toBeVisible();

    // AND: No category text is shown (or default placeholder)
    // Expected: Component doesn't crash with null category
  });

  test('should apply correct data-testid attributes for E2E tests', async ({ mount }) => {
    // GIVEN: Channel list
    const channels = createChannels(3);

    const component = await mount(
      <ChannelsList accountId={1} channels={channels} isLoading={false} />
    );

    // THEN: Container has data-testid
    await expect(component.locator('[data-testid="channels-list-container"]')).toBeVisible();

    // AND: Individual items have data-testid
    const items = component.locator('[data-testid="channel-list-item"]');
    expect(await items.count()).toBeGreaterThan(0);

    // Expected: Quality badges have testable attributes
    // Expected: Channel names, logos, categories are testable
  });

  test('should handle empty qualities array gracefully', async ({ mount }) => {
    // GIVEN: Channel with empty qualities array
    const channel = createChannel({
      name: 'No Quality Channel',
      qualities: [],
    });

    const component = await mount(
      <ChannelsList accountId={1} channels={[channel]} isLoading={false} />
    );

    // THEN: Channel is rendered
    await expect(component.getByText('No Quality Channel')).toBeVisible();

    // AND: No quality badges are shown (or default SD badge)
    // Expected: Component doesn't crash with empty qualities
  });

  test('should maintain performance with 1000 channels', async ({ mount }) => {
    // GIVEN: Very large channel list (1000 channels)
    const channels = createChannels(1000);

    // WHEN: Mounting component
    const startTime = Date.now();
    const component = await mount(
      <ChannelsList accountId={1} channels={channels} isLoading={false} />
    );
    const mountTime = Date.now() - startTime;

    // THEN: Component mounts quickly (under 2 seconds)
    expect(mountTime).toBeLessThan(2000);

    // AND: Component is visible
    await expect(component.locator('[data-testid="channels-list-container"]')).toBeVisible();

    // Expected: TanStack Virtual handles large lists efficiently
    // Expected: Only visible rows rendered (virtualization working)
  });
});

test.describe('ChannelsList Component - Accessibility', () => {
  test('should have accessible channel list structure', async ({ mount }) => {
    // GIVEN: Channel list
    const channels = createChannels(5);

    const component = await mount(
      <ChannelsList accountId={1} channels={channels} isLoading={false} />
    );

    // THEN: List has proper ARIA attributes
    // Expected: role="list" or semantic <ul> element
    // Expected: Individual items have role="listitem"
    const list = component.locator('[role="list"]').or(component.locator('ul')).first();
    await expect(list).toBeVisible();
  });

  test('should have accessible empty state', async ({ mount }) => {
    // GIVEN: No channels
    const component = await mount(
      <ChannelsList accountId={1} channels={[]} isLoading={false} />
    );

    // THEN: Empty state has clear message
    const emptyMessage = component.getByText(/no channels found/i);
    await expect(emptyMessage).toBeVisible();

    // Expected: Message is accessible to screen readers
  });

  test('should have accessible loading state', async ({ mount }) => {
    // GIVEN: Loading state
    const component = await mount(
      <ChannelsList accountId={1} channels={[]} isLoading={true} />
    );

    // THEN: Loading indicator has aria-label or role
    const loadingIndicator = component.getByText(/loading/i);
    await expect(loadingIndicator).toBeVisible();

    // Expected: Screen readers can announce loading state
  });
});
