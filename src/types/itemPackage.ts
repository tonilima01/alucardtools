export type AssetKind = "smd" | "texture" | "unknown";

export type ItemType = "hair" | "armor" | "costume" | "outros";
export type ItemSlot = "head" | "body" | "unknown";

export type CharacterClassId =
  | "fs"
  | "ks"
  | "ata"
  | "as"
  | "ms"
  | "mg"
  | "prs"
  | "pik"
  | "ass"
  | "sha"
  | "unknown";

export interface IndexedFile {
  id: string;
  path: string;
  name: string;
  ext: string;
  file: File;
  size: number;
  folder: string;
}

export interface TextureMatch {
  file: IndexedFile;
  reason: "smd-ref" | "same-base" | "family" | "near-name";
}

export interface CharacterBaseCandidate {
  classId: CharacterClassId;
  className: string;
  smd: IndexedFile;
  textures: TextureMatch[];
  confidence: "high" | "medium" | "low";
}

export interface ItemPackage {
  id: string;
  displayName: string;
  smd: IndexedFile;
  textures: TextureMatch[];
  missingTextures: string[];
  expectedTextures: string[];
  relatedFiles: IndexedFile[];
  familyKey: string;
  itemType: ItemType;
  slot: ItemSlot;
  classId: CharacterClassId;
  className: string;
  baseCharacter: CharacterBaseCandidate | null;
  isComplete: boolean;
  sourceFolder: string;
  score: number;
}

export interface PackageStats {
  smdCount: number;
  textureCount: number;
  completeCount: number;
  incompleteCount: number;
}
