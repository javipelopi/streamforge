import { gzipSync } from 'zlib';
import type { XmltvChannel } from './xmltv-channel.factory';
import type { Program } from './program.factory';

/**
 * Format date to XMLTV timestamp format: YYYYMMDDhhmmss ±HHMM
 */
function formatXmltvTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds} +0000`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate valid XMLTV XML string from channels and programs
 */
export function createXmltvXml(channels: XmltvChannel[], programs: Program[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<tv generator-info-name="Test Generator">\n';

  // Add channels
  for (const channel of channels) {
    xml += `  <channel id="${escapeXml(channel.channelId)}">\n`;
    xml += `    <display-name>${escapeXml(channel.displayName)}</display-name>\n`;
    if (channel.icon) {
      xml += `    <icon src="${escapeXml(channel.icon)}"/>\n`;
    }
    xml += `  </channel>\n`;
  }

  // Add programs
  for (const program of programs) {
    // Find the channel for this program
    const channel = channels.find((c) => c.id === program.xmltvChannelId);
    if (!channel) continue;

    const startTime = formatXmltvTimestamp(new Date(program.startTime));
    const endTime = formatXmltvTimestamp(new Date(program.endTime));

    xml += `  <programme start="${startTime}" stop="${endTime}" channel="${escapeXml(channel.channelId)}">\n`;
    xml += `    <title lang="en">${escapeXml(program.title)}</title>\n`;

    if (program.description) {
      xml += `    <desc lang="en">${escapeXml(program.description)}</desc>\n`;
    }

    if (program.category) {
      xml += `    <category lang="en">${escapeXml(program.category)}</category>\n`;
    }

    if (program.episodeInfo) {
      xml += `    <episode-num system="xmltv_ns">${escapeXml(program.episodeInfo)}</episode-num>\n`;
    }

    xml += `  </programme>\n`;
  }

  xml += '</tv>\n';

  return xml;
}

/**
 * Generate gzipped XMLTV data
 */
export function createXmltvXmlGz(channels: XmltvChannel[], programs: Program[]): Buffer {
  const xml = createXmltvXml(channels, programs);
  return gzipSync(Buffer.from(xml, 'utf-8'));
}

/**
 * Create sample XMLTV data with specified channel and program counts
 */
export function createSampleXmltvData(
  channelCount: number,
  programsPerChannel: number
): {
  xml: string;
  xmlGz: Buffer;
  channels: XmltvChannel[];
  programs: Program[];
} {
  // Use simple test data instead of importing factories to avoid circular dependencies
  const channels: XmltvChannel[] = [];
  const programs: Program[] = [];

  // Create channels
  for (let i = 0; i < channelCount; i++) {
    channels.push({
      id: i + 1,
      sourceId: 1,
      channelId: `test-channel-${i + 1}`,
      displayName: `Test Channel ${i + 1}`,
      icon: `https://example.com/channel-${i + 1}.png`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Create programs for each channel
  for (const channel of channels) {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < programsPerChannel; i++) {
      const startTime = new Date(startDate.getTime() + i * 60 * 60 * 1000); // 1-hour blocks
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      programs.push({
        id: channel.id * 1000 + i,
        xmltvChannelId: channel.id,
        title: `Program ${i + 1}`,
        description: `Description for program ${i + 1}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        category: 'Entertainment',
        episodeInfo: `1.${i}.0/1`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return {
    xml: createXmltvXml(channels, programs),
    xmlGz: createXmltvXmlGz(channels, programs),
    channels,
    programs,
  };
}

/**
 * Create minimal valid XMLTV for testing
 */
export function createMinimalXmltv(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="test.1">
    <display-name>Test Channel</display-name>
  </channel>
  <programme start="20260119120000 +0000" stop="20260119130000 +0000" channel="test.1">
    <title>Test Program</title>
  </programme>
</tv>`;
}

/**
 * Create invalid XMLTV for error testing
 */
export function createInvalidXmltv(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><tv><channel>'; // Unclosed tag
}
