import type { ItemSlot, ItemType } from "../types/itemPackage";
import { normalizeName } from "./nameRules";

export function classifyItemType(name: string): ItemType {
  const n = normalizeName(name);

  if (/^(kinght|knight|fighter|lutador|pikeman|archer|atalanta|assasin|assassin|mecanico|mechanician|mechanic|mago|magician|sacer|priest|priestess|shaman)\d*$/.test(n)) return "personagem";
  if (n.includes("hair") || n.includes("mask") || n.includes("msk") || n.includes("head") || n.includes("cap")) return "hair";
  if (n.includes("wing") || n.includes("asa") || n.includes("back") || n.includes("cape")) return "asa";
  if (n.includes("shield") || n.includes("escudo") || n.startsWith("its") || n.startsWith("itsh")) return "escudo";

  if (
    n.startsWith("itw") || n.includes("sword") || n.includes("axe") || n.includes("bow") ||
    n.includes("javelin") || n.includes("staff") || n.includes("claw") || n.includes("wand") ||
    n.includes("hammer") || n.includes("scythe") || n.includes("dagger")
  ) return "ataque";

  if (
    n.startsWith("itd") || n.includes("armor") || n.includes("robe") || n.includes("boot") ||
    n.includes("glove") || n.includes("gaunt") || n.includes("armadura") || n.includes("bota")
  ) return "defesa";

  if (n.includes("xmas") || n.includes("santa") || n.includes("dragon") || n.includes("lpk") || n.includes("kimono") || n.includes("dress") || n.includes("costume")) return "skin";

  return "outros";
}

export function classifySlot(name: string): ItemSlot {
  const t = classifyItemType(name);
  if (t === "ataque") return "weapon";
  if (t === "escudo") return "shield";
  if (t === "hair") return "head";
  if (t === "asa") return "wing";
  if (t === "defesa") return "body";
  if (t === "skin") return "skin";
  if (t === "personagem") return "character";
  return "unknown";
}

export function itemTypeLabel(type: ItemType): string {
  const labels: Record<ItemType, string> = {
    ataque: "Ataque",
    defesa: "Defesa",
    hair: "Hair/Mask",
    asa: "Asa/Capa",
    escudo: "Escudo",
    skin: "Skin/Costume",
    personagem: "Personagem",
    outros: "Outros",
  };
  return labels[type];
}

export function slotLabel(slot: ItemSlot): string {
  const labels: Record<ItemSlot, string> = {
    weapon: "Arma / ataque",
    body: "Corpo / defesa",
    head: "Cabeça / hair / mask",
    shield: "Escudo",
    wing: "Asa / costas",
    skin: "Skin / costume",
    character: "Base de personagem",
    unknown: "Não identificado",
  };
  return labels[slot];
}
