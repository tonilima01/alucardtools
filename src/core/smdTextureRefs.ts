export async function parseSmdTextureRefs(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const refs = new Set<string>();
  let current = "";

  const flush = () => {
    if (current.length >= 4) {
      const matches = current.match(/[A-Za-z0-9_ .()\-\\/]+\.(bmp|tga|png|dds|jpg|jpeg)/gi) || [];
      for (const m of matches) {
        const name = m.replace(/\\/g, "/").split("/").pop()?.trim();
        if (name) refs.add(name);
      }
    }
    current = "";
  };

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b <= 126) {
      current += String.fromCharCode(b);
      if (current.length > 300) flush();
    } else {
      flush();
    }
  }
  flush();

  return Array.from(refs);
}
