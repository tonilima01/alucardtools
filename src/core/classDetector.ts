import type { CharacterClassId } from "../types/itemPackage";
import { normalizeName } from "./nameRules";

const CLASS_LABELS: Record<CharacterClassId, string> = {
  fs: "Fighter",
  ks: "Knight",
  ata: "Atalanta",
  as: "Archer",
  ms: "Mechanician",
  mg: "Magician",
  prs: "Priestess",
  pik: "Pikeman",
  ass: "Assassin",
  sha: "Shaman",
  unknown: "Não detectada",
};

export function classLabel(classId: CharacterClassId): string {
  return CLASS_LABELS[classId];
}

export function detectClassFromName(name: string): CharacterClassId {
  const raw = name.toLowerCase();
  const n = normalizeName(name);

  if (/fighter|lutador|(^|[^a-z])fs([^a-z]|$)/i.test(raw) || /fs$/.test(n)) return "fs";
  if (/kinght|knight|kina|ks$/i.test(raw) || /ks$/.test(n)) return "ks";
  if (/atalanta|ata/i.test(raw) || /ata$/.test(n)) return "ata";
  if (/archer|arc|as$/i.test(raw) || /as$/.test(n)) return "as";
  if (/mechanician|mecanico|mech|mec|ms$/i.test(raw) || /ms$/.test(n)) return "ms";
  if (/magician|mago|mage|mg$/i.test(raw) || /mg$/.test(n)) return "mg";
  if (/priestess|priest|sacer|prs|pr$/i.test(raw) || /prs$/.test(n)) return "prs";
  if (/pikeman|pike|pik$/i.test(raw) || /pik$/.test(n)) return "pik";
  if (/assassin|assasin|ass$/i.test(raw) || /ass$/.test(n)) return "ass";
  if (/shaman|sha|shm$/i.test(raw) || /sha$/.test(n)) return "sha";

  return "unknown";
}

export function isBaseCharacterName(name: string): boolean {
  const n = normalizeName(name);
  return /^(fighter|lutador|kinght|knight|kina|archer|arc|atalanta|mecanico|mechanician|mech|mago|magician|sacer|priestess|pikeman|pike|assassin|assasin|shaman)([0-9]*)$/.test(n);
}
