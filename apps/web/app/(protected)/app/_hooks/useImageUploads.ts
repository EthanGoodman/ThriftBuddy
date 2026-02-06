import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Preview, PreviewWithSlot } from "../types";

export function useImageUploads() {
  const [mainImage, setMainImage] = useState<File | null>(null);
  const [files, setFiles] = useState<(File | null)[]>([null]);

  function addSlot() {
    setFiles((prev) => [...prev, null]);
  }

  function removeSlot(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function setSlotFile(index: number, file: File | null) {
    setFiles((prev) => {
      const next = prev.map((f, i) => (i === index ? file : f));

      if (index === prev.length - 1 && file != null) {
        next.push(null);
      }

      return next.length ? next : [null];
    });
  }

  const urlByFileRef = useRef<Map<File, string>>(new Map());

  function getObjectUrl(file: File) {
    const map = urlByFileRef.current;
    const existing = map.get(file);
    if (existing) return existing;

    const url = URL.createObjectURL(file);
    map.set(file, url);
    return url;
  }

  function revokeObjectUrl(file: File | null) {
    if (!file) return;
    const map = urlByFileRef.current;
    const url = map.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      map.delete(file);
    }
  }

  useEffect(() => {
    return () => {
      for (const url of urlByFileRef.current.values()) URL.revokeObjectURL(url);
      urlByFileRef.current.clear();
    };
  }, []);

  function removeMainSelected() {
    revokeObjectUrl(mainImage);
    setMainImage(null);
  }

  function removeExtraSelectedBySlotIndex(slotIndex: number) {
    setFiles((prev) => {
      revokeObjectUrl(prev[slotIndex]);
      const next = prev.filter((_, i) => i !== slotIndex);
      return next.length ? next : [null];
    });
  }

  const clearAllSlots = useCallback(() => setFiles([null]), []);

  const previews: Preview[] = useMemo(() => {
    const list: Preview[] = [];

    if (mainImage) {
      list.push({
        key: "main",
        url: getObjectUrl(mainImage),
        name: mainImage.name,
        label: "Main",
      });
    }

    const extras = files
      .map((f, idx) => ({ f, idx }))
      .filter(({ f }) => f != null) as { f: File; idx: number }[];

    extras.forEach(({ f, idx }, i) => {
      list.push({
        key: `extra-${idx}`,
        url: getObjectUrl(f),
        name: f.name,
        label: `Extra ${i + 1}`,
      });
    });

    return list;
  }, [mainImage, files]);

  const mainPreview = previews.find((p) => p.key === "main");

  const extraPreviews: PreviewWithSlot[] = previews
    .filter((p) => p.key.startsWith("extra-"))
    .map((p) => {
      const slotIndex = Number(p.key.replace("extra-", ""));
      return { ...p, slotIndex };
    });

  return {
    mainImage,
    setMainImage,
    files,
    addSlot,
    removeSlot,
    setSlotFile,
    clearAllSlots,
    removeMainSelected,
    removeExtraSelectedBySlotIndex,
    previews,
    mainPreview,
    extraPreviews,
  };
}
