'use client';

export function CheckInSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-zinc-200" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-zinc-200" />
          <div className="h-3 w-24 rounded bg-zinc-200" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-zinc-200" />
        <div className="h-3 w-full rounded bg-zinc-200" />
        <div className="h-3 w-3/4 rounded bg-zinc-200" />
      </div>
      <div className="flex gap-2">
        <div className="h-14 w-20 rounded-lg bg-zinc-200" />
        <div className="h-14 w-20 rounded-lg bg-zinc-200" />
        <div className="h-14 w-20 rounded-lg bg-zinc-200" />
        <div className="h-14 w-20 rounded-lg bg-zinc-200" />
      </div>
    </div>
  );
}
