import type { Metadata } from "next";
import { Listing } from "@/components/listing/listing";
import { SearchPanel } from "@/components/search/search-panel";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  return (
    <div className="container-luxe py-8 md:py-12">
      <h1 className="sr-only">Search</h1>
      <div className="mx-auto mb-10 max-w-2xl">
        <SearchPanel key={q} initialQuery={q} autoFocus={!q} />
      </div>
      {q && (
        <>
          <h2 className="mb-6 text-3xl md:text-4xl">Results for “{q}”</h2>
          <Listing searchParams={sp} showRelevance />
        </>
      )}
    </div>
  );
}
