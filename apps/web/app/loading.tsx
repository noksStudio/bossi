import { BossiLoader, RouteProgress } from '@/components/brand/loader';

export default function Loading() {
  return (
    <>
      <RouteProgress />
      <BossiLoader />
    </>
  );
}
