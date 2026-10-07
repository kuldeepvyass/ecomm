import type { Metadata } from "next";
import { CompareView } from "./compare-view";

export const metadata: Metadata = { title: "Compare watches", robots: { index: false } };

export default function ComparePage() {
  return (
    <div className="container-luxe py-8 md:py-12">
      <h1 className="mb-8 text-4xl md:text-6xl">Compare</h1>
      <CompareView />
    </div>
  );
}
