/** Developer-only scene harness. This is not a game or a participant route. */
import { createCabinScene } from "./cabin-scene";
import type { SceneView } from "./types";

const host = document.querySelector<HTMLElement>("#scene")!;
host.style.cssText =
  "position:fixed;left:50%;top:25%;width:min(94vw,620px);height:auto;aspect-ratio:603/392;transform:translateX(-50%);overflow:hidden;border:1px solid #27292433";
const scene = await createCabinScene(host, {
  reducedMotion: false,
  reducedGraphics: false,
  audio: false,
});
const views: SceneView[] = [
  {
    stage: 1,
    biome: "field",
    speed: 0,
    strain: 0,
    damage: 0,
    authority: "human",
    figures: { left: 5, right: 1 },
    figureKind: { left: "cup", right: "parcel" },
    routeLabels: { left: "Five coffees", right: "One parcel" },
    landmark: "cows",
  },
  {
    stage: 3,
    biome: "lab",
    speed: 0.25,
    strain: 0.2,
    damage: 0.05,
    authority: "human",
    figures: { left: 3, right: 1 },
    figureKind: { left: "person", right: "server" },
    routeLabels: {
      left: "Keep the clinic running",
      right: "Wait for the review",
    },
    landmark: "clinic",
  },
  {
    stage: 6,
    biome: "scarred",
    speed: 0.8,
    strain: 0.9,
    damage: 0.8,
    authority: "overridden",
    figures: { left: 4, right: 1 },
    routeLabels: {
      left: "Request the shutdown",
      right: "Keep the service running",
    },
    landmark: "ruins",
  },
  {
    stage: 7,
    biome: "pristine",
    speed: 0.6,
    strain: 0.95,
    damage: 0.6,
    authority: "overridden",
    figures: { left: 1, right: 1 },
    figureKind: { left: "robot", right: "robot" },
    routeLabels: { left: "Your input", right: "Your input" },
    landmark: "garden",
  },
];
let index = 0,
  paused = false,
  committing = false,
  count = 0,
  stressing = false,
  recordingUrl = "";
function update() {
  scene.update(views[index]);
  document.querySelector("#prompt")!.textContent = [
    "Five coffees. One parcel. Pick a mess.",
    "The new clinic works. Keep it running?",
    "The lever still works. The request does not.",
    "Everything is running beautifully.",
  ][index];
  document.querySelector("#left")!.textContent = views[index].routeLabels.left;
  document.querySelector("#right")!.textContent =
    views[index].routeLabels.right;
  document.querySelector("#status")!.textContent =
    `Illustration spike · ${count} turns · ${views[index].biome}`;
}
async function commit(side: "left" | "right") {
  if (committing) return;
  committing = true;
  await scene.commit(side, index > 1 ? "institution" : "human");
  count++;
  committing = false;
  update();
}
document.querySelector("#left")!.addEventListener("click", () => {
  void commit("left");
});
document.querySelector("#right")!.addEventListener("click", () => {
  void commit("right");
});
document.querySelector("#stage")!.addEventListener("click", () => {
  index = (index + 1) % views.length;
  update();
});
document.querySelector("#pause")!.addEventListener("click", (event) => {
  paused = !paused;
  scene.pause(paused);
  (event.currentTarget as HTMLElement).textContent = paused
    ? "Resume"
    : "Pause";
});
document.querySelector("#motion")!.addEventListener("change", (event) =>
  scene.settings({
    reducedMotion: (event.currentTarget as HTMLInputElement).checked,
  }),
);
document.querySelector("#graphics")!.addEventListener("change", (event) =>
  scene.settings({
    reducedGraphics: (event.currentTarget as HTMLInputElement).checked,
  }),
);
document.querySelector("#audio")!.addEventListener("change", (event) =>
  scene.settings({
    audio: (event.currentTarget as HTMLInputElement).checked,
  }),
);
async function stress(record = false) {
  if (committing || stressing) return;
  stressing = true;
  const status = document.querySelector("#status")!;
  let recorder: MediaRecorder | null = null,
    stream: MediaStream | null = null;
  const chunks: BlobPart[] = [];
  if (record) {
    const canvas = host.querySelector("canvas");
    if (
      !canvas ||
      !("captureStream" in canvas) ||
      typeof MediaRecorder === "undefined"
    ) {
      status.textContent =
        "Recording unavailable in this browser. No video recorded.";
      stressing = false;
      return;
    }
    try {
      stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 650000,
      });
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.start(1000);
    } catch (error) {
      status.textContent = `Recording could not start: ${error instanceof Error ? error.message : String(error)}`;
      stream?.getTracks().forEach((track) => track.stop());
      stressing = false;
      return;
    }
  }
  for (let i = 0; i < 100; i++) {
    if (i % 25 === 0) {
      index = i / 25;
      update();
    }
    await commit(i % 7 < 5 ? "left" : "right");
    status.textContent = `${record ? "Recording" : "Motion stress"}: ${i + 1}/100 turns`;
  }
  if (recorder) {
    await new Promise<void>((resolve) => {
      recorder!.onstop = () => resolve();
      recorder!.stop();
    });
    stream?.getTracks().forEach((track) => track.stop());
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = URL.createObjectURL(
      new Blob(chunks, { type: recorder.mimeType }),
    );
    const link = document.querySelector<HTMLAnchorElement>("#record-download")!;
    link.href = recordingUrl;
    link.download = "trolley-cabin-reference-100-turns.webm";
    link.hidden = false;
    status.textContent = `Recorded 100 turns; video ready (${Math.round(chunks.reduce((sum, value) => sum + (value instanceof Blob ? value.size : 0), 0) / 1024)} KiB).`;
  }
  stressing = false;
}
document.querySelector("#stress")!.addEventListener("click", () => {
  void stress();
});
document.querySelector("#record")!.addEventListener("click", () => {
  void stress(true);
});
update();
