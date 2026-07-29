import { mkdir, cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const source = path.join(root, "apps", "vscode-extension");
const release = path.join(root, "release", "vscode-extension");

await mkdir(release, { recursive: true });

await cp(path.join(source, "dist"), path.join(release, "dist"), {
  recursive: true,
});

await cp(path.join(source, "media"), path.join(release, "media"), {
  recursive: true,
});

try {
  await cp(
    path.join(root, "README.md"),
    path.join(release, "README.md")
  );
  const releaseReadme = path.join(release, "README.md");
  const readme = await readFile(releaseReadme, "utf8");
  await writeFile(
    releaseReadme,
    readme.replace(
      "apps/vscode-extension/media/video/TMTPshort.gif",
      "media/video/TMTPshort.gif"
    )
  );
} catch {}

try {
  await cp(
    path.join(root, "CHANGELOG.md"),
    path.join(release, "CHANGELOG.md")
  );
} catch {}

try {
  await cp(
    path.join(root, "LICENSE"),
    path.join(release, "LICENSE")
  );
} catch {}

const devManifest = JSON.parse(
  await readFile(path.join(source, "package.json"), "utf8")
);

const releaseManifest = JSON.parse(
  await readFile(path.join(source, "package.release.json"), "utf8")
);

const manifest = {
  ...devManifest,
  ...releaseManifest
};

delete manifest.dependencies;

await writeFile(
  path.join(release, "package.json"),
  JSON.stringify(manifest, null, 2)
);

console.log("✅ Release package created:", release);
