export default function OutfitStudioLoading() {
  return (
    <main className="min-h-screen bg-[#efebe4] p-4">
      <div className="mx-auto h-16 max-w-[1600px] animate-pulse rounded-2xl bg-white/70" />
      <div className="mx-auto mt-4 grid max-w-[1600px] gap-4 lg:grid-cols-[210px_1fr_230px]">
        <div className="hidden h-[640px] animate-pulse rounded-3xl bg-white/60 lg:block" />
        <div className="mx-auto aspect-[4/5] h-[640px] max-h-[75vh] animate-pulse rounded-3xl bg-white/75" />
        <div className="hidden h-[640px] animate-pulse rounded-3xl bg-white/60 lg:block" />
      </div>
    </main>
  );
}
