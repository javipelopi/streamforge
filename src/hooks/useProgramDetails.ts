/**
 * Hook for fetching program details
 * Story 5.8: EPG Program Details Panel
 *
 * Task 7: Create useProgramDetails hook
 */

import { useState, useEffect, useRef } from 'react';
import { getProgramById, type ProgramWithChannel } from '../lib/tauri';

interface UseProgramDetailsResult {
  /** Program with channel data, or null if not found/loading */
  programWithChannel: ProgramWithChannel | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message, or null if no error */
  error: string | null;
}

/**
 * Hook to fetch program details by ID
 *
 * AC #1: Fetch program details from backend when programId changes
 * AC #2: Handle null programId (return null program)
 *
 * @param programId - Program ID to fetch, or null for no selection
 * @returns Program data, loading state, and error state
 */
export function useProgramDetails(programId: number | null): UseProgramDetailsResult {
  const [programWithChannel, setProgramWithChannel] = useState<ProgramWithChannel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    // Handle null programId - clear state and return early (Task 7.5)
    if (programId === null) {
      setProgramWithChannel(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const fetchProgram = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getProgramById(programId);

        if (isMountedRef.current) {
          setProgramWithChannel(result);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load program');
          setProgramWithChannel(null);
          setIsLoading(false);
        }
      }
    };

    fetchProgram();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [programId]);

  return { programWithChannel, isLoading, error };
}
