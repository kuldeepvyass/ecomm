"use client";

import { useState } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { moderateReview, replyToReview } from "@/server/actions/admin/store";

export function ReviewModeration({ id, status, reply }: { id: string; status: string; reply: string }) {
  const [text, setText] = useState(reply);
  return (
    <div className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        Reply as the store (optional, shown under the review)
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="rounded-[2px] border border-border bg-bg p-2 text-sm text-fg" />
      </label>
      <div className="flex flex-wrap gap-2">
        {status !== "APPROVED" && <ActionButton size="sm" action={() => moderateReview(id, "APPROVED", text)} data-testid="approve-review">Approve</ActionButton>}
        {status !== "REJECTED" && <ActionButton size="sm" variant="outline" action={() => moderateReview(id, "REJECTED", text)}>Reject</ActionButton>}
        {status === "APPROVED" && text !== reply && <ActionButton size="sm" variant="outline" action={() => replyToReview(id, text)}>Save reply</ActionButton>}
        <ActionButton size="sm" variant="ghost" className="text-danger" confirmText="Delete this review permanently?" action={() => moderateReview(id, "DELETE")}>Delete</ActionButton>
      </div>
    </div>
  );
}
