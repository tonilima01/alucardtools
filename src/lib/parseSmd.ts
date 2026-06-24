// SMD binary format parser for legacy PristonTale "SMD Model data" files.
// All values little-endian, 32-bit Windows (x86) structs.
// Vertex coords stored as int32 = float * 256 (fONE = 256).

export interface SmdMesh {
  /** Flat float32 array: x,y,z per vertex (already divided by 256) */
  positions: Float32Array;
  /** Flat float32 array: u,v per vertex */
  uvs: Float32Array;
  /** uint32 indices (3 per triangle) */
  indices: Uint32Array;
  /** Main texture filename extracted/scanned from the SMD */
  textureName: string;
  /** All texture candidates found in the material/string area */
  textureNames: string[];
  /** Number of object chunks merged into this mesh */
  objectCount: number;
}

const FONE = 256;

// struct sizes (bytes)
const SZ_HEADER = 556;    // char[24] + legacy header + 32*smFRAME_POS(16)
const SZ_OBJINFO = 40;    // char Name[32] + int Length + int ObjFilePoint
const SZ_OBJ3D = 2236;    // smLegacyOBJ3D
const SZ_VERTEX = 24;     // 6 int32s  (x,y,z,nx,ny,nz)
const SZ_FACE = 36;       // WORD[4] + float[6] + DWORD
const SZ_TEXLINK = 32;    // float[3]+float[3]+DWORD+DWORD

interface SmdObjectInfo {
  name: string;
  size: number;
  offset: number;
}

export function parseSmd(buf: ArrayBuffer): SmdMesh {
  const dv = new DataView(buf);

  const magic = readString(dv, 0, 24);
  if (!magic.startsWith("SMD Model data Ver")) {
    throw new Error(`Not an SMD file (magic: "${magic}")`);
  }

  const headerObjectCount = Math.max(1, dv.getInt32(24, true));
  const materialOffset = dv.getInt32(32, true);
  const textureNames = extractTextureNames(dv);
  const objectInfos = readObjectInfos(dv, headerObjectCount, materialOffset);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let globalVertexIndex = 0;
  let parsedObjects = 0;

  for (const obj of objectInfos) {
    if (!isObjectOffsetValid(dv, obj.offset)) continue;

    const texLinkBase32 = dv.getUint32(obj.offset + 12, true);
    const nVertex = dv.getInt32(obj.offset + 84, true);
    const nFace = dv.getInt32(obj.offset + 88, true);
    const nTexLink = dv.getInt32(obj.offset + 92, true);

    if (!isSaneCount(nVertex, 1, 200000) || !isSaneCount(nFace, 1, 300000) || !isSaneCount(nTexLink, 0, 300000)) {
      continue;
    }

    const vertexArrOff = obj.offset + SZ_OBJ3D;
    const faceArrOff = vertexArrOff + nVertex * SZ_VERTEX;
    const texLinkArrOff = faceArrOff + nFace * SZ_FACE;

    if (vertexArrOff < 0 || faceArrOff < 0 || texLinkArrOff < 0 || vertexArrOff >= dv.byteLength || faceArrOff >= dv.byteLength) {
      continue;
    }

    for (let f = 0; f < nFace; f++) {
      const fOff = faceArrOff + f * SZ_FACE;
      if (fOff + SZ_FACE > dv.byteLength) break;

      const vi0 = dv.getUint16(fOff + 0, true);
      const vi1 = dv.getUint16(fOff + 2, true);
      const vi2 = dv.getUint16(fOff + 4, true);
      if (vi0 >= nVertex || vi1 >= nVertex || vi2 >= nVertex) continue;

      const lpTexLinkOld = dv.getUint32(fOff + 32, true);
      let u0 = 0, v0 = 0, u1 = 0, v1 = 0, u2 = 0, v2 = 0;

      if (lpTexLinkOld !== 0 && texLinkBase32 !== 0 && nTexLink > 0) {
        const tlIdx = Math.floor((lpTexLinkOld - texLinkBase32) / SZ_TEXLINK);
        const tlOff = texLinkArrOff + tlIdx * SZ_TEXLINK;
        if (tlIdx >= 0 && tlIdx < nTexLink && tlOff + SZ_TEXLINK <= dv.byteLength) {
          u0 = dv.getFloat32(tlOff + 0, true);
          u1 = dv.getFloat32(tlOff + 4, true);
          u2 = dv.getFloat32(tlOff + 8, true);
          v0 = dv.getFloat32(tlOff + 12, true);
          v1 = dv.getFloat32(tlOff + 16, true);
          v2 = dv.getFloat32(tlOff + 20, true);
        }
      }

      for (const [vi, u, v] of [[vi0, u0, v0], [vi1, u1, v1], [vi2, u2, v2]] as [number, number, number][]) {
        const vOff = vertexArrOff + vi * SZ_VERTEX;
        if (vOff + SZ_VERTEX > dv.byteLength) continue;
        positions.push(
          dv.getInt32(vOff + 0, true) / FONE,
          dv.getInt32(vOff + 4, true) / FONE,
          dv.getInt32(vOff + 8, true) / FONE,
        );
        uvs.push(u, 1 - v);
        indices.push(globalVertexIndex++);
      }
    }

    parsedObjects++;
  }

  if (positions.length === 0) {
    throw new Error("SMD lido, mas nenhum objeto/face válido foi encontrado.");
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    textureName: textureNames[0] ?? "",
    textureNames,
    objectCount: parsedObjects,
  };
}

function readObjectInfos(dv: DataView, headerObjectCount: number, materialOffset: number): SmdObjectInfo[] {
  let countFromTable = 0;
  if (materialOffset > SZ_HEADER && materialOffset <= dv.byteLength && (materialOffset - SZ_HEADER) % SZ_OBJINFO === 0) {
    countFromTable = Math.floor((materialOffset - SZ_HEADER) / SZ_OBJINFO);
  }

  const count = Math.min(Math.max(countFromTable || headerObjectCount, 1), 128);
  const infos: SmdObjectInfo[] = [];

  for (let i = 0; i < count; i++) {
    const off = SZ_HEADER + i * SZ_OBJINFO;
    if (off + SZ_OBJINFO > dv.byteLength) break;

    const name = readString(dv, off, 32);
    const size = dv.getUint32(off + 32, true);
    const offset = dv.getUint32(off + 36, true);

    if (offset > 0 && offset < dv.byteLength) {
      infos.push({ name, size, offset });
    }
  }

  return infos;
}

function isObjectOffsetValid(dv: DataView, offset: number): boolean {
  return offset > 0 && offset + SZ_OBJ3D < dv.byteLength && readString(dv, offset, 4) === "DCB\u00c1";
}

function isSaneCount(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function readString(dv: DataView, offset: number, maxLen: number): string {
  let s = "";
  for (let i = 0; i < maxLen && offset + i < dv.byteLength; i++) {
    const b = dv.getUint8(offset + i);
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s;
}

function extractTextureNames(dv: DataView): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  let current = "";

  const flush = () => {
    const matches = current.match(/[A-Za-z0-9_ .()\-\\/]+\.(?:bmp|tga|dds|png|jpg|jpeg)/gi) ?? [];
    for (const match of matches) {
      const fileName = match.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
      const key = fileName.toLowerCase();
      if (fileName && !seen.has(key)) {
        seen.add(key);
        found.push(fileName);
      }
    }
    current = "";
  };

  for (let i = 0; i < dv.byteLength; i++) {
    const b = dv.getUint8(i);
    if (b >= 32 && b <= 126) {
      current += String.fromCharCode(b);
      if (current.length > 260) flush();
    } else {
      if (current.length >= 4) flush();
      current = "";
    }
  }
  if (current.length >= 4) flush();

  return found;
}
