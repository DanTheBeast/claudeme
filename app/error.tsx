'use client';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[CallMe] Error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
      <h1 className="text-2xl font-bold text-center">Something went wrong</h1>
      <p className="text-gray-600 text-center max-w-md">{error.message}</p>
      <button
        onClick={() => reset()}
        className="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition"
      >
        Try again
      </button>
    </div>
  );
}
