'use client';

export default function OwnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="mb-2 text-xl font-semibold text-token-text-primary">Something went wrong</h2>
        <p className="mb-4 text-sm text-token-text-secondary">
          {error.message || 'Failed to load this page.'}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-token-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
