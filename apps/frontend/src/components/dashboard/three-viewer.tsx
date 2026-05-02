"use client";

import { Cpu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export function ThreeViewer({ modelPath }: { modelPath: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    let frameId = 0;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f1117");

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(4, 2.6, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor("#0f1117", 1);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
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
        scene.add(model);

        const fittedBox = new THREE.Box3().setFromObject(model);
        const sphere = fittedBox.getBoundingSphere(new THREE.Sphere());
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
        setError(loadError.message || "Unable to load the GLB model.");
        setIsLoading(false);
      },
    );

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
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
    };
  }, [modelPath]);

  return (
    <>
      <div className="panel-title">
        <Cpu size={20} strokeWidth={1.8} />
        3D Viewer <span>{modelPath}</span>
      </div>
      <div className="viewer-canvas" ref={mountRef} />
      {isLoading ? (
        <div className="loading-overlay">
          <div className="spinner">Loading plant asset</div>
        </div>
      ) : null}
      {error ? <div className="viewer-error">{error}</div> : null}
    </>
  );
}
