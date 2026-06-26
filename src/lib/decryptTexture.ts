// @ts-nocheck
// BMP/TGA decryption from smTexture.cpp:DecryptBMP / DecryptTGA
// BMP: if !BM → set BM, pBuffer[c] -= (c*c) for c=2..13, zero bytes 2-5
// TGA: if G8 → set 0x00 0x00, pBuffer[c] -= (c*c) for c=2..17

import * as THREE from "three";
import { TGALoader } from "three/addons/loaders/TGALoader.js";
import { DDSLoader } from "three/addons/loaders/DDSLoader.js";

function decryptBmp(buf: ArrayBuffer): Blob {
  const bytes = new Uint8Array(buf.slice(0));
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
    bytes[0] = 0x42;
    bytes[1] = 0x4d;
    for (let c = 2; c < 14; c++) bytes[c] = (bytes[c] - c * c) & 0xff;
  }
  bytes[2] = 0; bytes[3] = 0; bytes[4] = 0; bytes[5] = 0;
  return new Blob([bytes], { type: "image/bmp" });
}

function decryptTga(buf: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buf.slice(0));
  if (bytes[0] === 0x47 && bytes[1] === 0x38) {
    bytes[0] = 0x00;
    bytes[1] = 0x00;
    for (let c = 2; c < 18; c++) bytes[c] = (bytes[c] - c * c) & 0xff;
  }
  return bytes.buffer;
}

// TGALoader.parse() in Three.js r180+ returns a raw TexData object
// { data, width, height, flipY, generateMipmaps, minFilter }, NOT a DataTexture.
// We must build the DataTexture manually.
function tgaToTexture(buf: ArrayBuffer): any {
  const loader = new TGALoader();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const td = loader.parse(buf) as any;
  const tex = new THREE.DataTexture(td.data, td.width, td.height);
  if (td.flipY !== undefined)           tex.flipY           = td.flipY;
  if (td.generateMipmaps !== undefined) tex.generateMipmaps = td.generateMipmaps;
  if (td.minFilter !== undefined)       tex.minFilter       = td.minFilter;
  if (td.colorSpace !== undefined)      tex.colorSpace      = td.colorSpace;
  tex.needsUpdate = true;
  return tex;
}

export async function textureFromFile(file: File): Promise<any> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const buf = await file.arrayBuffer();

  if (ext === "tga") {
    const decrypted = decryptTga(buf);
    return tgaToTexture(decrypted);
  }


  if (ext === "dds") {
    const blob = new Blob([buf], { type: "image/vnd-ms.dds" });
    const url = URL.createObjectURL(blob);
    return new Promise<any>((resolve, reject) => {
      new DDSLoader().load(
        url,
        (tex: any) => { URL.revokeObjectURL(url); resolve(tex); },
        undefined,
        (err: unknown) => { URL.revokeObjectURL(url); reject(err); },
      );
    });
  }

  if (ext === "bmp") {
    const blob = decryptBmp(buf);
    const url = URL.createObjectURL(blob);
    return new Promise<any>((resolve, reject) => {
      new THREE.TextureLoader().load(
        url,
        (tex: any) => { URL.revokeObjectURL(url); resolve(tex); },
        undefined,
        (err: unknown) => { URL.revokeObjectURL(url); reject(err); },
      );
    });
  }

  const blob = new Blob([buf]);
  const url = URL.createObjectURL(blob);
  return new Promise<any>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex: any) => { URL.revokeObjectURL(url); resolve(tex); },
      undefined,
      (err: unknown) => { URL.revokeObjectURL(url); reject(err); },
    );
  });
}
