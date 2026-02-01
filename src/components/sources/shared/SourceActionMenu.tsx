/**
 * Source Action Menu Component
 * Sources-Centric UX Unification: Phase 1.4
 *
 * Context-sensitive dropdown menu for source items (channels/streams):
 * - Actions based on link status (orphan, linked, promoted)
 * - Consistent styling across all source types
 */
import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Plus, Link, Unlink, Eye, Edit } from 'lucide-react';
import type { LinkStatus } from '../../../lib/tauri';

export interface SourceActionMenuAction {
  /** Action identifier */
  id: string;
  /** Display label */
  label: string;
  /** Lucide icon component */
  icon: React.ElementType;
  /** Action callback */
  onClick: () => void;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Whether action is destructive (shown in red) */
  destructive?: boolean;
}

export interface SourceActionMenuProps {
  /** Link status determines available actions */
  linkStatus: LinkStatus;
  /** Callback for "Promote to Lineup" action (orphans only) */
  onPromote?: () => void;
  /** Callback for "Link to XMLTV" action (orphans only) */
  onLinkToXmltv?: () => void;
  /** Callback for "View Linked Channels" action (linked only) */
  onViewLinked?: () => void;
  /** Callback for "Unlink" action (linked only) */
  onUnlink?: () => void;
  /** Callback for "View in Lineup" action (promoted only) */
  onViewInLineup?: () => void;
  /** Callback for "Edit Channel" action (promoted only) */
  onEditChannel?: () => void;
  /** Additional custom actions */
  customActions?: SourceActionMenuAction[];
  /** Test ID prefix */
  testIdPrefix?: string;
}

export function SourceActionMenu({
  linkStatus,
  onPromote,
  onLinkToXmltv,
  onViewLinked,
  onUnlink,
  onViewInLineup,
  onEditChannel,
  customActions = [],
  testIdPrefix,
}: SourceActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close menu on ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Build actions based on link status
  const getActionsForStatus = (): SourceActionMenuAction[] => {
    const actions: SourceActionMenuAction[] = [];

    switch (linkStatus) {
      case 'orphan':
        if (onPromote) {
          actions.push({
            id: 'promote',
            label: 'Promote to Lineup',
            icon: Plus,
            onClick: () => {
              onPromote();
              setIsOpen(false);
            },
          });
        }
        if (onLinkToXmltv) {
          actions.push({
            id: 'link',
            label: 'Link to XMLTV Channel',
            icon: Link,
            onClick: () => {
              onLinkToXmltv();
              setIsOpen(false);
            },
          });
        }
        break;

      case 'linked':
        if (onViewLinked) {
          actions.push({
            id: 'view-linked',
            label: 'View Linked Channels',
            icon: Eye,
            onClick: () => {
              onViewLinked();
              setIsOpen(false);
            },
          });
        }
        if (onUnlink) {
          actions.push({
            id: 'unlink',
            label: 'Unlink from XMLTV',
            icon: Unlink,
            onClick: () => {
              onUnlink();
              setIsOpen(false);
            },
            destructive: true,
          });
        }
        break;

      case 'promoted':
        if (onViewInLineup) {
          actions.push({
            id: 'view-lineup',
            label: 'View in Lineup',
            icon: Eye,
            onClick: () => {
              onViewInLineup();
              setIsOpen(false);
            },
          });
        }
        if (onEditChannel) {
          actions.push({
            id: 'edit-channel',
            label: 'Edit Channel',
            icon: Edit,
            onClick: () => {
              onEditChannel();
              setIsOpen(false);
            },
          });
        }
        break;
    }

    return actions;
  };

  const statusActions = getActionsForStatus();
  const allActions = [...statusActions, ...customActions];

  // Don't render if no actions available
  if (allActions.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        data-testid={testIdPrefix ? `${testIdPrefix}-menu-button` : 'action-menu-button'}
        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        aria-label="Actions menu"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          data-testid={testIdPrefix ? `${testIdPrefix}-menu` : 'action-menu'}
          className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
          role="menu"
        >
          {allActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                disabled={action.disabled}
                data-testid={
                  testIdPrefix ? `${testIdPrefix}-action-${action.id}` : `action-${action.id}`
                }
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  action.destructive
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                role="menuitem"
              >
                <Icon className="w-4 h-4" />
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Get link status badge styling
 */
export function getLinkStatusBadge(status: LinkStatus): { className: string; label: string } {
  switch (status) {
    case 'linked':
      return {
        className: 'bg-blue-100 text-blue-800',
        label: 'Linked',
      };
    case 'orphan':
      return {
        className: 'bg-amber-100 text-amber-800',
        label: 'Orphan',
      };
    case 'promoted':
      return {
        className: 'bg-green-100 text-green-800',
        label: 'Promoted',
      };
    default:
      return {
        className: 'bg-gray-100 text-gray-800',
        label: 'Unknown',
      };
  }
}
