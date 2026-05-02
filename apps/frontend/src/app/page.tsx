import { readdir } from "node:fs/promises";
import path from "node:path";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

const GLB_PUBLIC_DIR = "/assets/fdp";

async function getModelPath() {
  const assetDir = path.join(process.cwd(), "public", "assets", "fdp");
  const files = await readdir(assetDir);
  const model = files.find((file) => file.toLowerCase().endsWith(".glb"));

  if (!model) {
    throw new Error("No .glb file found in public/assets/fdp.");
  }

  return `${GLB_PUBLIC_DIR}/${model}`;
}

export default async function Home() {
  const modelPath = await getModelPath();

  return <DashboardShell modelPath={modelPath} />;
}
