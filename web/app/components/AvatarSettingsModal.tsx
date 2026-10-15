"use client";

import { useEffect, useState } from "react";

type Avatar = { id: string; url: string; storagePath?: string; isCutout?: boolean };

type Props = {
  open: boolean;
  avatars: Avatar[];
  activeAvatarId: string | null;
  onSelectAvatar: (id: string) => void;
  onRemoveAvatar: (id: string) => void;
  onOpenUploadModal: () => void;
  onClose: () => void;
};

export default function AvatarSettingsModal({
  open,
  avatars,
  activeAvatarId,
  onSelectAvatar,
  onRemoveAvatar,
  onOpenUploadModal,
  onClose,
}: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E3DB]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#1A1A1A]">Avatar Settings</h2>
              <span className="rounded-full bg-[#F7F5F0] border border-[#E8E3DB] px-2 py-0.5 text-[10px] font-semibold text-[#8A8480]">
                {avatars.length} saved
              </span>
            </div>
            <p className="text-xs text-[#8A8480] mt-0.5">
              Select your active avatar, manage photo cutouts, or remove avatars from your cloud storage.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-[#E8E3DB] text-[#8A8480] hover:text-[#1A1A1A] transition flex items-center justify-center text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Avatar List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {avatars.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-[#F7F5F0] border border-[#E8E3DB] flex items-center justify-center text-2xl">
                👤
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">No avatars saved</p>
                <p className="text-xs text-[#8A8480] mt-0.5">
                  Upload a photo to see virtual clothes styled on yourself.
                </p>
              </div>
            </div>
          ) : (
            avatars.map((av, index) => {
              const isActive = av.id === activeAvatarId;
              const isConfirming = confirmDeleteId === av.id;

              return (
                <div
                  key={av.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition ${
                    isActive
                      ? "border-[#1A1A1A] bg-[#F7F5F0]/60 ring-1 ring-[#1A1A1A]"
                      : "border-[#E8E3DB] bg-white hover:border-[#C4A882]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail */}
                    <div
                      className={`relative h-16 w-12 shrink-0 overflow-hidden rounded-xl border ${
                        av.isCutout ? "bg-[#F7F5F0]" : "bg-neutral-100"
                      } border-[#E8E3DB] flex items-center justify-center`}
                    >
                      <img
                        src={av.url}
                        alt={`Avatar ${index + 1}`}
                        className={`h-full w-full ${av.isCutout ? "object-contain" : "object-cover"}`}
                      />
                    </div>

                    {/* Metadata & Badges */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-[#1A1A1A]">Avatar {index + 1}</p>
                        {isActive && (
                          <span className="rounded-full bg-[#1A1A1A] text-white px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                            Active
                          </span>
                        )}
                        {av.isCutout && (
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-1.5 py-0.5 text-[9px] font-semibold uppercase">
                            Cutout
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8A8480] mt-0.5">
                        {av.isCutout ? "Background removed · Clean stage" : "Original full-body portrait"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isActive && !isConfirming && (
                      <button
                        type="button"
                        onClick={() => onSelectAvatar(av.id)}
                        className="rounded-xl border border-[#E8E3DB] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F7F5F0] hover:border-[#1A1A1A] transition"
                      >
                        Use
                      </button>
                    )}

                    {isConfirming ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveAvatar(av.id);
                            setConfirmDeleteId(null);
                          }}
                          className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-xs"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-xl border border-[#E8E3DB] px-2 py-1.5 text-xs text-[#8A8480] hover:text-[#1A1A1A] transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(av.id)}
                        title="Delete avatar from account and cloud storage"
                        className="rounded-xl border border-[#E8E3DB] p-2 text-[#8A8480] hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50 transition"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#E8E3DB] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenUploadModal();
            }}
            className="flex items-center gap-1.5 rounded-full border border-[#E8E3DB] px-3.5 py-1.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F7F5F0] transition"
          >
            + Upload New Avatar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#1A1A1A] px-5 py-1.5 text-xs font-semibold text-white hover:bg-black transition shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

