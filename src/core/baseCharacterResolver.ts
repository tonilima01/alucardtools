import type { CharacterBaseCandidate, CharacterClassId, IndexedFile, TextureMatch } from "../types/itemPackage";
import { classLabel, detectClassFromName, isBaseCharacterName } from "./classDetector";
import { isSmdExt, isTextureExt, normalizeName, stripExt } from "./nameRules";

function baseTextureMatches(smd: IndexedFile, tex: IndexedFile): boolean {
  const smdBase = normalizeName(stripExt(smd.name));
  const texBase = normalizeName(stripExt(tex.name));
  return texBase === smdBase || texBase.startsWith(smdBase) || smd.folder === tex.folder;
}

function makeBaseCandidate(smd: IndexedFile, textures: IndexedFile[]): CharacterBaseCandidate {
  const classId = detectClassFromName(smd.name);
  const matchedTextures: TextureMatch[] = textures
    .filter(t => baseTextureMatches(smd, t))
    .slice(0, 4)
    .map(file => ({ file, reason: "family" as const }));

  return {
    classId,
    className: classLabel(classId),
    smd,
    textures: matchedTextures,
    confidence: isBaseCharacterName(smd.name) ? "high" : "medium",
  };
}

export function resolveBaseCharacters(files: IndexedFile[]): CharacterBaseCandidate[] {
  const smds = files.filter(f => isSmdExt(f.ext));
  const textures = files.filter(f => isTextureExt(f.ext));

  return smds
    .filter(f => isBaseCharacterName(f.name))
    .map(f => makeBaseCandidate(f, textures))
    .filter(b => b.classId !== "unknown")
    .sort((a, b) => a.className.localeCompare(b.className));
}

export function findBaseForClass(classId: CharacterClassId, bases: CharacterBaseCandidate[]): CharacterBaseCandidate | null {
  if (classId === "unknown") return null;
  const exact = bases.find(b => b.classId === classId && b.confidence === "high");
  if (exact) return exact;
  return bases.find(b => b.classId === classId) ?? null;
}
