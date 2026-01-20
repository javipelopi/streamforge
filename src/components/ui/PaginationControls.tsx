/**
 * Pagination Controls Component
 *
 * Reusable pagination component with page size dropdown and navigation.
 * Supports page sizes: 10, 50, 100, 200, 500
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE_OPTIONS = [10, 50, 100, 200, 500] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface PaginationControlsProps {
  currentPage: number;
  pageSize: PageSize;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}

export function PaginationControls({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = Number(e.target.value) as PageSize;
    onPageSizeChange(newPageSize);
    // Reset to first page when changing page size
    onPageChange(1);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div
      data-testid="pagination-controls"
      className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200"
    >
      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="page-size" className="text-sm text-gray-600">
          Show:
        </label>
        <select
          id="page-size"
          data-testid="page-size-select"
          value={pageSize}
          onChange={handlePageSizeChange}
          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-600">entries</span>
      </div>

      {/* Page info and navigation */}
      <div className="flex items-center gap-3">
        <span data-testid="pagination-info" className="text-sm text-gray-600">
          {totalItems > 0
            ? `Showing ${startItem}-${endItem} of ${totalItems}`
            : 'No items'}
        </span>

        <div className="flex items-center gap-1">
          <button
            data-testid="pagination-prev"
            type="button"
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm text-gray-600 min-w-[4rem] text-center">
            Page {totalPages > 0 ? currentPage : 0} of {totalPages}
          </span>
          <button
            data-testid="pagination-next"
            type="button"
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
