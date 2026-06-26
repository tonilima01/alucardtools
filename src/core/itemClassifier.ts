import type { ItemSlot, ItemType } from "../types/itemPackage";
import { normalizeName } from "./nameRules";

export function classifyItemType(name: string): ItemType {
  const n = normalizeName(name);

  if (n.includes("hair") || n.includes("mask") || n.includes("msk") || n.includes("head") || n.includes("helm") || n.includes("cap")) {
    return "hair";
  }

  if (
    n.includes("costume") || n.includes("skin") || n.includes("dress") || n.includes("xmas") ||
    n.includes("santa") || n.includes("dragon") || n.includes("event") || n.includes("special") ||
    n.includes("kimono") || n.includes("lpk") || n.includes("traje")
  ) {
    return "costume";
  }

  if (
    n.includes("armor") || n.includes("armour") || n.includes("robe") || n.includes("body") ||
    n.includes("armadura") || n.startsWith("itda") || n.startsWith("itdb") ||
    /^da[0-9]/.test(n) || /^high[0-9]/.test(n)
  ) {
    return "armor";
  }

  return "outros";
}

export function classifySlot(name: string): ItemSlot {
  const t = classifyItemType(name);
  if (t === "hair") return "head";
  if (t === "armor" || t === "costume") return "body";
  return "unknown";
}

export function itemTypeLabel(type: ItemType): string {
  const labels: Record<ItemType, string> = {
    hair: "Hair / cabeça",
    armor: "Armor / corpo",
    costume: "Traje / costume",
    outros: "Outros",
  };
  return labels[type];
}

export function slotLabel(slot: ItemSlot): string {
  const labels: Record<ItemSlot, string> = {
    head: "Cabeça",
    body: "Corpo",
    unknown: "Não identificado",
  };
  return labels[slot];
}

export function isSupportedVisualType(type: ItemType): boolean {
  return type === "hair" || type === "armor" || type === "costume";
}
