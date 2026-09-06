import { RouteProgress, Skeleton } from '@/components/brand/loader';

export default function Loading() {
  return (
    <>
      <RouteProgress />
      <div className="space-y-6">
        <Skeleton className="h-7 w-52" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    </>
  );
}
