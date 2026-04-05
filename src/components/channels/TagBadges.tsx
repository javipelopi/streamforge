import { memo } from 'react';

interface TagBadgesProps {
  tags: string[];
}

export const TagBadges = memo(function TagBadges({ tags }: TagBadgesProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
        >
          {tag}
        </span>
      ))}
    </div>
  );
});
