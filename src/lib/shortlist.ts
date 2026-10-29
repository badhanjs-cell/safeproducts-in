import { useEffect, useState } from "react";
import type { Product } from "@/lib/searchContract";

const KEY = "sp_shortlist";

type ShortlistEntry = {
  id: string;
  product: Product | null;
  addedAt: string;
};

function normalizeEntry(value: unknown): ShortlistEntry | null {
  if (typeof value === "string" && value.trim()) {
    return { id: value.trim(), product: null, addedAt: new Date(0).toISOString() };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !raw.id.trim()) return null;
  const product = raw.product && typeof raw.product === "object" && !Array.isArray(raw.product)
    ? raw.product as Product
    : null;
  const addedAt = typeof raw.addedAt === "string" && raw.addedAt ? raw.addedAt : new Date(0).toISOString();
  return { id: raw.id.trim(), product, addedAt };
}

function readEntries(): ShortlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const entries: ShortlistEntry[] = [];
    for (const raw of parsed) {
      const entry = normalizeEntry(raw);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      entries.push(entry);
    }
    return entries;
  } catch {
    return [];
  }
}

function writeEntries(entries: ShortlistEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event("sp_shortlist_change"));
}

function useEntries() {
  const [entries, setEntries] = useState<ShortlistEntry[]>([]);
  useEffect(() => {
    const refresh = () => setEntries(readEntries());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("sp_shortlist_change", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("sp_shortlist_change", refresh);
    };
  }, []);
  return entries;
}

export function useShortlist() {
  return useEntries().map((entry) => entry.id);
}

export function useShortlistEntries() {
  return useEntries();
}

export function addToShortlist(product: Product) {
  const current = readEntries();
  const existing = current.find((entry) => entry.id === product.id);
  const next: ShortlistEntry[] = existing
    ? current.map((entry) => entry.id === product.id ? { ...entry, product } : entry)
    : [...current, { id: product.id, product, addedAt: new Date().toISOString() }];
  writeEntries(next);
}

export function removeFromShortlist(id: string) {
  writeEntries(readEntries().filter((entry) => entry.id !== id));
}

// Backward-compatible helper for older callers. New product cards use addToShortlist(product).
export function toggleShortlist(id: string, product?: Product) {
  if (isShortlisted(id)) removeFromShortlist(id);
  else if (product) addToShortlist(product);
  else writeEntries([...readEntries(), { id, product: null, addedAt: new Date().toISOString() }]);
}

export function clearShortlist() {
  writeEntries([]);
}

export function isShortlisted(id: string) {
  return readEntries().some((entry) => entry.id === id);
}
