"use client";

import { Activity, Cpu, Gauge, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type SectionInfo = {
  id: string;
  name: string;
  type: string;
  status: "Nominal" | "Inspect" | "Offline";
  temperature: string;
  vibration: string;
  efficiency: string;
  notes: string;
};

const sectionProfiles = [
  {
    type: "Thermal exchange loop",
    notes: "Waste heat recovery segment. Monitor delta-T drift and fouling indicators.",
  },
  {
    type: "Rotating equipment",
    notes: "Pump or compressor assembly. Watch vibration trend before load changes.",
  },
  {
    type: "Process vessel",
    notes: "Static asset zone. Compare shell temperature with audit baseline.",
  },
  {
    type: "Instrumentation cluster",
    notes: "Sensor-dense section. Validate live telemetry against document intake records.",
  },
];

const INTERACTIVE_OBJECT_NAMES = [
  "Circle030 P 0301 A LUBEOIL 1 0",
  "Circle042 P 0301 A (VALVE 5) 0",
  "Circle017 p 0301A (MESINVALVE) 0",
];

const INTERACTIVE_OBJECT_NAME_SET = new Set(
  INTERACTIVE_OBJECT_NAMES.map(normalizeObjectName),
);
const INTERACTIVE_LABEL_BY_KEY = new Map(
  INTERACTIVE_OBJECT_NAMES.map((name) => [normalizeObjectName(name), name]),
);

function normalizeObjectName(name: string) {
  return name.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function cleanSectionName(name: string, index: number) {
  const cleaned = name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned && !/^mesh$/i.test(cleaned) ? cleaned : `Asset Section ${index + 1}`;
}

function buildSectionInfo(object: THREE.Object3D, index: number): SectionInfo {
  const profile = sectionProfiles[index % sectionProfiles.length];
  const name = cleanSectionName(object.name, index);
  const load = 72 + ((index * 7) % 22);

  return {
    id: object.uuid,
    name,
    type: profile.type,
    status: index % 9 === 0 ? "Inspect" : "Nominal",
    temperature: `${36 + ((index * 5) % 38)} C`,
    vibration: `${(0.8 + ((index * 13) % 24) / 10).toFixed(1)} mm/s`,
    efficiency: `${load}%`,
    notes: profile.notes,
  };
}

function materialHasEmissive(
  material: THREE.Material,
): material is THREE.Material & {
  emissive: THREE.Color;
  emissiveIntensity: number;
} {
  return "emissive" in material && material.emissive instanceof THREE.Color;
}

function cloneMaterialWithGlow(material: THREE.Material, intensity: number) {
  const clone = material.clone();
  clone.side = THREE.DoubleSide;

  if (materialHasEmissive(clone)) {
    clone.emissive.set("#00e5ff");
    clone.emissiveIntensity = intensity;
  }

  clone.needsUpdate = true;

  return clone;
}

function createHotspotTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 58);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(0,229,255,0.95)");
  gradient.addColorStop(0.34, "rgba(0,229,255,0.32)");
  gradient.addColorStop(0.58, "rgba(0,229,255,0.13)");
  gradient.addColorStop(1, "rgba(0,229,255,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  context.strokeStyle = "rgba(0,229,255,0.95)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(64, 64, 34, 0, Math.PI * 2);
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export function ThreeViewer({ modelPath }: { modelPath: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const focusByNameRef = useRef<(name: string) => void>(() => undefined);
  const [selectedSection, setSelectedSection] = useState<SectionInfo | null>(null);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    let frameId = 0;
    let disposed = false;
    let pointerStart: { x: number; y: number } | null = null;
    const clickableTargets: THREE.Object3D[] = [];
    const sectionInfoByUuid = new Map<string, SectionInfo>();
    const focusTargetByUuid = new Map<string, THREE.Object3D>();
    const focusTargetByName = new Map<string, THREE.Object3D>();
    const sectionInfoByName = new Map<string, SectionInfo>();
    const interactiveGlowMaterials: THREE.Material[] = [];
    const hotspotMaterials: THREE.SpriteMaterial[] = [];
    const hotspotTexture = createHotspotTexture();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let highlighted:
      | {
          mesh: THREE.Mesh;
          originalMaterial: THREE.Material | THREE.Material[];
        }
      | null = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f1117");

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(4, 2.6, 5);
    const cameraGoal = {
      position: camera.position.clone(),
      target: new THREE.Vector3(0, 0, 0),
      active: false,
    };
    const modelCenter = new THREE.Vector3(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor("#0f1117", 1);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };

    scene.add(new THREE.AmbientLight("#ffffff", 1.75));

    const keyLight = new THREE.DirectionalLight("#ffffff", 2.4);
    keyLight.position.set(4, 7, 6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight("#00e5ff", 0.9);
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(8, 16, "#00e5ff", "#1d2f38");
    grid.position.y = -1.9;
    scene.add(grid);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;

      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const setPointerFromEvent = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    };

    const getTargetFromEvent = (event: PointerEvent) => {
      setPointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObjects(clickableTargets, false);

      return hit?.object ?? null;
    };

    const highlightObject = (object: THREE.Object3D) => {
      if (highlighted) {
        highlighted.mesh.material = highlighted.originalMaterial;
      }

      const mesh =
        object instanceof THREE.Mesh
          ? object
          : object
              .children
              .find((child): child is THREE.Mesh => child instanceof THREE.Mesh);

      if (!mesh) {
        return;
      }

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = materials.map((material) => cloneMaterialWithGlow(material, 0.78));

      highlighted = {
        mesh,
        originalMaterial: mesh.material,
      };
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
    };

    const focusObject = (object: THREE.Object3D) => {
      const focusTarget = focusTargetByUuid.get(object.uuid) ?? object;
      const box = new THREE.Box3().setFromObject(focusTarget);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const radius = Math.max(sphere.radius, 0.35);
      const outwardDirection = sphere.center
        .clone()
        .sub(modelCenter)
        .normalize();

      if (outwardDirection.lengthSq() < 0.01) {
        outwardDirection.set(0.7, 0.35, 1).normalize();
      }

      const distance = Math.max(
        (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.9,
        1.1,
      );

      cameraGoal.target.copy(sphere.center);
      cameraGoal.position
        .copy(sphere.center)
        .add(outwardDirection.multiplyScalar(distance))
        .add(new THREE.Vector3(0, radius * 0.25, 0));
      cameraGoal.active = true;

      controls.minDistance = Math.max(radius * 0.28, 0.2);
      controls.maxDistance = Math.max(distance * 4, 8);
      highlightObject(focusTarget);
      setSelectedSection(
        sectionInfoByUuid.get(object.uuid) ??
          sectionInfoByUuid.get(focusTarget.uuid) ??
          buildSectionInfo(focusTarget, 0),
      );
    };

    focusByNameRef.current = (name: string) => {
      const normalizedName = normalizeObjectName(name);
      const target = focusTargetByName.get(normalizedName);

      if (target) {
        focusObject(target);
        return;
      }

      setSelectedSection(
        sectionInfoByName.get(normalizedName) ?? {
          id: normalizedName,
          name,
          type: "Target not found in loaded GLB",
          status: "Offline",
          temperature: "--",
          vibration: "--",
          efficiency: "--",
          notes:
            "The requested interactive object name was not found in the loaded model hierarchy. Check the GLB object name spelling.",
        },
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerStart || event.button !== 0) {
        return;
      }

      const movement = Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      );
      pointerStart = null;

      if (movement > 5) {
        return;
      }

      const target = getTargetFromEvent(event);

      if (target) {
        focusObject(target);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      renderer.domElement.style.cursor = getTargetFromEvent(event) ? "crosshair" : "grab";
    };

    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("contextmenu", preventContextMenu);

    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        if (disposed) {
          return;
        }

        const model = gltf.scene;
        const initialBox = new THREE.Box3().setFromObject(model);
        const center = initialBox.getCenter(new THREE.Vector3());
        const size = initialBox.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z, 1);
        const scale = 3.8 / maxDimension;

        model.position.sub(center);
        model.scale.setScalar(scale);

        const registeredTargets = new Set<string>();
        let interactiveIndex = 0;

        model.traverse((object) => {
          const normalizedName = normalizeObjectName(object.name);

          if (!INTERACTIVE_OBJECT_NAME_SET.has(normalizedName)) {
            return;
          }

          const sectionInfo = buildSectionInfo(object, interactiveIndex);
          sectionInfo.name = INTERACTIVE_LABEL_BY_KEY.get(normalizedName) ?? object.name;
          interactiveIndex += 1;
          focusTargetByName.set(normalizedName, object);
          sectionInfoByName.set(normalizedName, sectionInfo);

          const objectBox = new THREE.Box3().setFromObject(object);
          const objectSphere = objectBox.getBoundingSphere(new THREE.Sphere());
          const hotspotMaterial = new THREE.SpriteMaterial({
            color: "#00e5ff",
            depthTest: false,
            depthWrite: false,
            map: hotspotTexture,
            opacity: 0.92,
            transparent: true,
          });
          const hotspot = new THREE.Sprite(hotspotMaterial);
          const hotspotSize = Math.max(objectSphere.radius * 1.35, 0.35);

          hotspot.position.copy(objectSphere.center);
          hotspot.scale.setScalar(hotspotSize);
          hotspot.renderOrder = 999;
          hotspot.userData.sectionName = object.name;
          scene.add(hotspot);
          hotspotMaterials.push(hotspotMaterial);
          clickableTargets.push(hotspot);
          sectionInfoByUuid.set(hotspot.uuid, sectionInfo);
          focusTargetByUuid.set(hotspot.uuid, object);

          object.traverse((child) => {
            if (!(child instanceof THREE.Mesh) || registeredTargets.has(child.uuid)) {
              return;
            }

            child.castShadow = true;
            child.receiveShadow = true;

            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];
            const shinyMaterials = materials.map((material) =>
              cloneMaterialWithGlow(material, 0.18),
            );

            interactiveGlowMaterials.push(...shinyMaterials);
            child.material = Array.isArray(child.material)
              ? shinyMaterials
              : shinyMaterials[0];

            registeredTargets.add(child.uuid);
            clickableTargets.push(child);
            sectionInfoByUuid.set(child.uuid, sectionInfo);
            focusTargetByUuid.set(child.uuid, object);
          });
        });
        setAvailableSections(Array.from(focusTargetByName.keys()));
        scene.add(model);

        const fittedBox = new THREE.Box3().setFromObject(model);
        const sphere = fittedBox.getBoundingSphere(new THREE.Sphere());
        modelCenter.copy(sphere.center);
        const radius = Math.max(sphere.radius, 1.8);
        const cameraDistance =
          radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));

        camera.near = radius / 100;
        camera.far = radius * 100;
        camera.position.set(cameraDistance * 0.65, radius * 0.45, cameraDistance);
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.maxDistance = cameraDistance * 2.4;
        controls.minDistance = radius * 0.35;
        controls.update();

        setIsLoading(false);
      },
      undefined,
      (loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the GLB model.",
        );
        setIsLoading(false);
      },
    );

    const animate = () => {
      const pulse = 0.16 + Math.sin(performance.now() * 0.003) * 0.06;

      interactiveGlowMaterials.forEach((material) => {
        if (materialHasEmissive(material)) {
          material.emissiveIntensity = pulse;
        }
      });
      hotspotMaterials.forEach((material) => {
        material.opacity = 0.72 + Math.sin(performance.now() * 0.004) * 0.2;
        material.rotation += 0.012;
      });

      if (cameraGoal.active) {
        camera.position.lerp(cameraGoal.position, 0.08);
        controls.target.lerp(cameraGoal.target, 0.08);

        if (
          camera.position.distanceTo(cameraGoal.position) < 0.02 &&
          controls.target.distanceTo(cameraGoal.target) < 0.02
        ) {
          cameraGoal.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("contextmenu", preventContextMenu);
      controls.dispose();
      renderer.dispose();
      hotspotTexture.dispose();
      hotspotMaterials.forEach((material) => material.dispose());
      renderer.domElement.remove();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach((material) => material.dispose());
        }
      });
      focusByNameRef.current = () => undefined;
    };
  }, [modelPath]);

  return (
    <>
      <div className="panel-title">
        <Cpu size={20} strokeWidth={1.8} />
        3D Viewer <span>{modelPath}</span>
      </div>
      <div className="viewer-hint">Click one of the 3 cyan-tagged sections</div>
      <aside className="section-picker" aria-label="Inspectable sections">
        <div className="section-picker-title">Inspectable Objects</div>
        <div className="section-picker-list">
          {INTERACTIVE_OBJECT_NAMES.map((name) => {
            const isAvailable = availableSections.includes(normalizeObjectName(name));
            const isSelected =
              selectedSection &&
              normalizeObjectName(selectedSection.name) === normalizeObjectName(name);

            return (
              <button
                className={`section-picker-item${isSelected ? " selected" : ""}`}
                key={name}
                onClick={() => focusByNameRef.current(name)}
                type="button"
              >
                <span>{name}</span>
                <small>{isAvailable ? "Ready" : "Not found"}</small>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="viewer-canvas" ref={mountRef} />
      {selectedSection ? (
        <aside className="section-drawer" aria-label="Selected model section">
          <button
            aria-label="Close section details"
            className="drawer-close"
            onClick={() => setSelectedSection(null)}
            type="button"
          >
            <X size={16} />
          </button>
          <div className="drawer-kicker">Selected Section</div>
          <h2>{selectedSection.name}</h2>
          <div className={`drawer-status ${selectedSection.status.toLowerCase()}`}>
            {selectedSection.status}
          </div>

          <div className="metric-grid">
            <div>
              <Gauge size={16} />
              <span>Efficiency</span>
              <strong>{selectedSection.efficiency}</strong>
            </div>
            <div>
              <Activity size={16} />
              <span>Vibration</span>
              <strong>{selectedSection.vibration}</strong>
            </div>
          </div>

          <dl className="section-facts">
            <div>
              <dt>Type</dt>
              <dd>{selectedSection.type}</dd>
            </div>
            <div>
              <dt>Temperature</dt>
              <dd>{selectedSection.temperature}</dd>
            </div>
            <div>
              <dt>Asset ID</dt>
              <dd>{selectedSection.id.slice(0, 8).toUpperCase()}</dd>
            </div>
          </dl>

          <p>{selectedSection.notes}</p>
        </aside>
      ) : null}
      {isLoading ? (
        <div className="loading-overlay">
          <div className="spinner">Loading plant asset</div>
        </div>
      ) : null}
      {error ? <div className="viewer-error">{error}</div> : null}
    </>
  );
}
