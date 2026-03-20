"use client";

import React, { useState } from "react";
import clsx from "clsx";

interface FeedbackFormProps {
  runId: string | null;
  onClose: () => void;
}

export function FeedbackForm({ runId, onClose }: FeedbackFormProps) {
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runId || !comment.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          comment: comment.trim(),
          rating: rating ?? undefined,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Failed to submit feedback.");
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-1 border border-border rounded-lg w-96 p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-text-primary">
              Simulation Feedback
            </div>
            {runId && (
              <div className="text-2xs font-mono text-text-tertiary mt-0.5">
                Run: {runId}
              </div>
            )}
          </div>
          <button
            className="text-text-tertiary hover:text-text-primary text-sm"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div className="py-6 text-center">
            <div className="text-accent-green text-xl mb-2">✓</div>
            <div className="text-text-primary text-sm font-semibold mb-1">
              Thank you for your feedback!
            </div>
            <div className="text-text-tertiary text-xs mb-4">
              Your response has been recorded against run {runId}.
            </div>
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!runId && (
              <div className="px-3 py-2 bg-amber-900/30 border border-amber-700/40 rounded text-xs text-amber-300">
                No active simulation run. Please run a simulation first.
              </div>
            )}

            {/* Rating */}
            <div>
              <label className="text-2xs text-text-secondary block mb-2">
                Overall rating (optional)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={clsx(
                      "w-8 h-8 rounded border text-sm transition-colors",
                      rating === r
                        ? "bg-accent-yellow/20 border-accent-yellow text-accent-yellow"
                        : "bg-surface-3 border-border text-text-tertiary hover:border-text-tertiary"
                    )}
                    onClick={() => setRating(rating === r ? null : r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="text-2xs text-text-secondary block mb-1">
                Comment *
              </label>
              <textarea
                className="gpse-input min-h-[100px] resize-y"
                placeholder="Describe your observations about the simulation results, model behaviour, or district configuration…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={5000}
                required
              />
              <div className="text-2xs text-text-tertiary mt-0.5 text-right">
                {comment.length}/5000
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-900/30 border border-red-700/40 rounded text-xs text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!runId || !comment.trim() || submitting}
              >
                {submitting ? "Submitting…" : "Submit Feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
