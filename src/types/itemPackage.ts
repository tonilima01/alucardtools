export type AssetKind = "smd" | "texture" | "unknown";

export type ItemType =
  | "ataque"
  | "defesa"
  | "hair"
  | "asa"
  | "escudo"
  | "skin"
  | "personagem"
  | "outros";

export type ItemSlot =
  | "weapon"
  | "body"
  | "head"
  | "shield"
  | "wing"
  | "skin"
  | "character"
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
