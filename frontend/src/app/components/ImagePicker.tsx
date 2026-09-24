import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

// Shows the newly chosen file if there is one, otherwise the existing image (if not removed).
export function ImagePicker({ file, existingUrl, onChange, onRemoveExisting }: {
  file: File | null;
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
  onRemoveExisting?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    if (!chosen) return;
    if (!/^image\/(png|jpeg|webp)$/.test(chosen.type)) {
      setError("Please choose a JPG, PNG or WEBP image.");
      return;
    }
    if (chosen.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    setError("");
    onChange(chosen);
  }

  const shown = preview || existingUrl || null;

  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-1">Photo (optional)</label>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSelect} />
      {shown ? (
        <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border">
          <img src={shown} alt="Announcement" className="h-48 w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow hover:bg-white">Change</button>
            <button
              type="button"
              onClick={() => (file ? onChange(null) : onRemoveExisting?.())}
              className="rounded-lg bg-white/90 p-1.5 text-red-600 shadow hover:bg-white"
              title="Remove photo"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full max-w-md flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-8 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all"
        >
          <ImagePlus size={24} />
          Add a photo of the activity
          <span className="text-xs font-normal">JPG, PNG or WEBP · up to 5 MB</span>
        </button>
      )}
      {error && <div className="mt-1.5 text-xs text-red-600">{error}</div>}
    </div>
  );
}
