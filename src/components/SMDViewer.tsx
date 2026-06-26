// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { parseSmd } from "../lib/parseSmd";
import { textureFromFile } from "../lib/decryptTexture";
import type { CharacterBaseCandidate, ItemPackage, TextureMatch } from "../types/itemPackage";
import { LoadingOverlay } from "./LoadingOverlay";

interface Props {
  item: ItemPackage | null;
}

interface ViewerStats {
  triangles: number;
  vertices: number;
  objects: number;
  bounds: string;
  texture: string;
  status: string;
  base: string;
}

interface ManualTransform {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
}

const DEFAULT_TRANSFORM: ManualTransform = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 };

function boundsText(box: THREE.Box3): string {
  const s = new THREE.Vector3();
  box.getSize(s);
  return `${s.x.toFixed(1)} × ${s.y.toFixed(1)} × ${s.z.toFixed(1)}`;
}

function pickBestTexture(textures: TextureMatch[], textureNames: string[]): File | null {
  if (!textures.length) return null;
  for (const texName of textureNames) {
    const exact = textures.find(t => t.file.name.toLowerCase() === texName.toLowerCase());
    if (exact) return exact.file.file;
    const sameBase = textures.find(t => t.file.name.replace(/\.[^.]+$/, "").toLowerCase() === texName.replace(/\.[^.]+$/, "").toLowerCase());
    if (sameBase) return sameBase.file.file;
  }
  return textures[0].file.file;
}

function setGroupTransform(group: THREE.Group, transform: ManualTransform, eixoPT: boolean): void {
  group.position.set(transform.x, transform.y, transform.z);
  group.rotation.set(
    THREE.MathUtils.degToRad(transform.rx + (eixoPT ? -90 : 0)),
    THREE.MathUtils.degToRad(transform.ry),
    THREE.MathUtils.degToRad(transform.rz),
  );
  group.scale.setScalar(transform.scale);
}

async function buildMeshFromSmd(
  file: File,
  textures: TextureMatch[],
  textureEnabled: boolean,
  fallbackColor: number,
  wireframe: boolean,
  transparent = false,
  opacity = 1,
): Promise<{ mesh: THREE.Mesh; triangles: number; vertices: number; objects: number; textureName: string; texturized: boolean }> {
  const buf = await file.arrayBuffer();
  const parsed = parseSmd(buf);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(parsed.positions, 3));
  if (parsed.uvs.length) geometry.setAttribute("uv", new THREE.BufferAttribute(parsed.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(parsed.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  let texture: THREE.Texture | null = null;
  const bestTexture = pickBestTexture(textures, parsed.textureNames);
  if (bestTexture && textureEnabled) {
    try {
      texture = await textureFromFile(bestTexture) as THREE.Texture;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    } catch (err) {
      console.warn("Falha ao carregar textura", bestTexture.name, err);
      texture = null;
    }
  }

  const material = new THREE.MeshStandardMaterial({
    color: texture ? 0xffffff : fallbackColor,
    map: texture,
    roughness: 0.62,
    metalness: 0.08,
    side: THREE.DoubleSide,
    wireframe,
    transparent,
    opacity,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return {
    mesh,
    triangles: parsed.indices.length / 3,
    vertices: parsed.positions.length / 3,
    objects: parsed.objectCount,
    textureName: bestTexture?.name || parsed.textureName || "sem textura",
    texturized: Boolean(texture),
  };
}

function disposeObject(object: THREE.Object3D) {
  object.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
}

export function SMDViewer({ item }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const itemGroupRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<number | null>(null);

  const [textureEnabled, setTextureEnabled] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [grid, setGrid] = useState(false);
  const [axes, setAxes] = useState(false);
  const [eixoPT, setEixoPT] = useState(true);
  const [showManual, setShowManual] = useState(true);
  const [showBase, setShowBase] = useState(true);
  const [transform, setTransform] = useState<ManualTransform>(DEFAULT_TRANSFORM);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ViewerStats | null>(null);

  const modeLabel = useMemo(() => {
    if (!item) return "Montagem";
    if (item.itemType === "hair") return "Montagem Hair";
    if (item.itemType === "armor") return "Montagem Armor";
    if (item.itemType === "costume") return "Montagem Traje";
    return "Montagem";
  }, [item]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0x050816, 80, 180);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
    camera.position.set(0, 10, 34);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = false;
    controls.enablePan = true;
    controls.minDistance = 2;
    controls.maxDistance = 1200;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xdde8ff, 0x111018, 1.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(18, 24, 20);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8ea6ff, 1.1);
    fill.position.set(-18, 8, -8);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffa36c, 0.9);
    rim.position.set(-8, 14, 22);
    scene.add(rim);

    const gridHelper = new THREE.GridHelper(80, 40, 0x4f5d92, 0x1c2447);
    gridHelper.name = "grid";
    gridHelper.visible = false;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(18);
    axesHelper.name = "axes";
    axesHelper.visible = false;
    scene.add(axesHelper);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0x6174bd, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(9.8, 10.05, 96), ringMat);
    ring.name = "showcaseRing";
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.015;
    scene.add(ring);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const tick = () => {
      controls.autoRotate = false;
      controls.update();
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      ro.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const axesObj = scene?.getObjectByName("axes");
    const gridObj = scene?.getObjectByName("grid");
    if (axesObj) axesObj.visible = axes;
    if (gridObj) gridObj.visible = grid;
  }, [axes, grid]);

  useEffect(() => {
    if (itemGroupRef.current) setGroupTransform(itemGroupRef.current, transform, eixoPT);
  }, [transform, eixoPT]);

  useEffect(() => {
    const root = rootGroupRef.current;
    if (!root) return;
    root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        const material = obj.material as THREE.MeshStandardMaterial;
        material.wireframe = wireframe;
        material.needsUpdate = true;
      }
    });
  }, [wireframe]);

  useEffect(() => {
    const root = rootGroupRef.current;
    if (!root) return;
    const base = root.getObjectByName("baseCharacter");
    if (base) base.visible = showBase;
  }, [showBase]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const scene = sceneRef.current;
      if (!scene || !item) return;
      setLoading(true);
      setLoadingText("Preparando montagem");
      setLoadingProgress(6);
      setError(null);
      setStats(null);
      setTransform(DEFAULT_TRANSFORM);
      if (controlsRef.current) controlsRef.current.autoRotate = false;

      if (rootGroupRef.current) {
        scene.remove(rootGroupRef.current);
        disposeObject(rootGroupRef.current);
        rootGroupRef.current = null;
        itemGroupRef.current = null;
      }

      try {
        const root = new THREE.Group();
        root.name = "mountRoot";

        let baseInfo: Awaited<ReturnType<typeof buildMeshFromSmd>> | null = null;
        const base: CharacterBaseCandidate | null = item.baseCharacter;
        if (base) {
          setLoadingText(`Carregando base ${base.smd.name}`);
          setLoadingProgress(24);
          baseInfo = await buildMeshFromSmd(base.smd.file, base.textures, textureEnabled, 0x303a55, wireframe, true, 0.34);
          if (cancelled) return;
          baseInfo.mesh.name = "baseCharacter";
          root.add(baseInfo.mesh);
        }

        setLoadingText(`Carregando ${item.displayName}`);
        setLoadingProgress(56);
        const itemInfo = await buildMeshFromSmd(item.smd.file, item.textures, textureEnabled, 0xaebcff, wireframe, false, 1);
        if (cancelled) return;

        const itemGroup = new THREE.Group();
        itemGroup.name = "itemMount";
        itemGroup.add(itemInfo.mesh);
        setGroupTransform(itemGroup, DEFAULT_TRANSFORM, eixoPT);
        root.add(itemGroup);
        itemGroupRef.current = itemGroup;

        scene.add(root);
        rootGroupRef.current = root;
        fitCameraToObject(root);

        const box = new THREE.Box3().setFromObject(root);
        setStats({
          triangles: itemInfo.triangles + (baseInfo?.triangles ?? 0),
          vertices: itemInfo.vertices + (baseInfo?.vertices ?? 0),
          objects: itemInfo.objects + (baseInfo?.objects ?? 0),
          bounds: boundsText(box),
          texture: itemInfo.textureName,
          status: itemInfo.texturized ? "texturizado" : item.textures.length ? "textura falhou" : "sem textura",
          base: base?.smd.name ?? "base não encontrada",
        });
        setLoadingText("Finalizando preview");
        setLoadingProgress(100);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar SMD.");
      } finally {
        if (!cancelled) setTimeout(() => setLoading(false), 150);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [item, textureEnabled]);

  function fitCameraToObject(object: THREE.Object3D) {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxSize = Math.max(size.x, size.y, size.z, 1);
    const distance = maxSize * 1.75;
    camera.position.set(center.x + distance * 0.28, center.y + maxSize * 0.18, center.z + distance);
    controls.target.copy(center);
    camera.near = Math.max(0.01, maxSize / 200);
    camera.far = Math.max(1000, maxSize * 20);
    camera.updateProjectionMatrix();
    controls.autoRotate = false;
    controls.update();
  }

  function exportPng() {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const a = document.createElement("a");
    a.download = `${item?.displayName?.replace(/\.[^.]+$/, "") || "alucard-montagem"}.png`;
    a.href = renderer.domElement.toDataURL("image/png");
    a.click();
  }

  function updateTransform(key: keyof ManualTransform, value: number) {
    setTransform(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="viewer-stage">
      <div className="viewer-toolbar compact-toolbar">
        <button className="tool active">{modeLabel}</button>
        <button className={`tool ${textureEnabled ? "active" : ""}`} onClick={() => setTextureEnabled(v => !v)}>Textura</button>
        <button className={`tool ${showBase ? "active" : ""}`} onClick={() => setShowBase(v => !v)} disabled={!item?.baseCharacter}>Base</button>
        <button className={`tool ${wireframe ? "active" : ""}`} onClick={() => setWireframe(v => !v)}>Wireframe</button>
        <button className={`tool ${grid ? "active" : ""}`} onClick={() => setGrid(v => !v)}>Grid</button>
        <button className={`tool ${axes ? "active" : ""}`} onClick={() => setAxes(v => !v)}>Eixos</button>
        <button className={`tool ${eixoPT ? "active" : ""}`} onClick={() => setEixoPT(v => !v)}>Eixo PT</button>
        <button className="tool" onClick={() => rootGroupRef.current && fitCameraToObject(rootGroupRef.current)}>Centralizar</button>
        <button className={`tool ${showManual ? "active" : ""}`} onClick={() => setShowManual(v => !v)}>Ajuste manual</button>
        <button className="tool export" onClick={exportPng} disabled={!item}>Exportar PNG</button>
      </div>

      <div ref={mountRef} className="canvas-host" />
      <LoadingOverlay show={loading} title="Montando preview" text={loadingText} progress={loadingProgress} />

      {!item && (
        <div className="empty-viewer">
          <div className="viewer-orb">PT</div>
          <h2>Selecione Hair, Armor ou Traje</h2>
          <p>O sistema monta o pacote com SMD + texturas e tenta aplicar sobre a base da classe encontrada na tmABCD.</p>
        </div>
      )}

      {error && <div className="viewer-error"><b>Erro ao abrir modelo</b><span>{error}</span></div>}

      {item && stats && (
        <div className="showcase-card compact-card">
          <span className="kicker">ALUCARD-TOOLS MONTAGEM</span>
          <h2>{item.displayName}</h2>
          <p>{item.smd.path}</p>
          <div className="showcase-stats">
            <div><b>{stats.triangles.toLocaleString("pt-BR")}</b><span>triângulos</span></div>
            <div><b>{stats.vertices.toLocaleString("pt-BR")}</b><span>vértices</span></div>
            <div><b>{item.className}</b><span>classe</span></div>
            <div><b>{stats.bounds}</b><span>bounds</span></div>
          </div>
          <div className={`texture-status ${stats.status === "texturizado" ? "ok" : "warn"}`}>Textura: {stats.texture}</div>
          <div className={`texture-status ${item.baseCharacter ? "ok" : "warn"}`}>Base: {stats.base}</div>
        </div>
      )}

      {showManual && item && (
        <div className="manual-panel">
          <div className="section-head"><h2>Ajuste do item</h2><button onClick={() => setTransform(DEFAULT_TRANSFORM)}>Reset</button></div>
          <Control label="X" min={-80} max={80} step={0.1} value={transform.x} onChange={v => updateTransform("x", v)} />
          <Control label="Y" min={-80} max={80} step={0.1} value={transform.y} onChange={v => updateTransform("y", v)} />
          <Control label="Z" min={-80} max={80} step={0.1} value={transform.z} onChange={v => updateTransform("z", v)} />
          <Control label="Rot X" min={-180} max={180} step={1} value={transform.rx} onChange={v => updateTransform("rx", v)} />
          <Control label="Rot Y" min={-180} max={180} step={1} value={transform.ry} onChange={v => updateTransform("ry", v)} />
          <Control label="Rot Z" min={-180} max={180} step={1} value={transform.rz} onChange={v => updateTransform("rz", v)} />
          <Control label="Escala" min={0.05} max={8} step={0.05} value={transform.scale} onChange={v => updateTransform("scale", v)} />
        </div>
      )}

      <div className="hint-row"><span>Arraste para girar câmera</span><span>Scroll para zoom</span><span>Objeto inicia parado</span></div>
    </div>
  );
}

function Control({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="control-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
      <b>{value.toFixed(label === "Escala" ? 2 : 1)}</b>
    </label>
  );
}
