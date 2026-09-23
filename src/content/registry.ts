import type { Manifest, Node } from "../contracts/index.ts";
import { createCampaign } from "../simulation/index.ts";
import { SLICE_MANIFEST, SLICE_NODES } from "./slice.ts";
import { CAMPAIGN_MANIFEST, CAMPAIGN_NODES } from "./campaign/index.ts";
import {
  SLICE_MANIFEST as ARCHIVED_MANIFEST,
  SLICE_NODES as ARCHIVED_NODES,
} from "./archive/slice-8ac27217.ts";
import {
  SLICE_MANIFEST as GEOMETRIC_MANIFEST,
  SLICE_NODES as GEOMETRIC_NODES,
} from "./archive/slice-510ec90a.ts";
import {
  SLICE_MANIFEST as FABLE_MANIFEST,
  SLICE_NODES as FABLE_NODES,
} from "./archive/slice-89f849e2.ts";

export const ARCHIVED_SLICE_CONTENT_HASH =
  "8ac27217117bf5b4394d5cfe2ffcf15309e50ae2a1a0880d26c610c9af94a614";
export const GEOMETRIC_SLICE_CONTENT_HASH =
  "510ec90a46d1e15c0d0a77ce5386e3951460bbff70d5d137538e3246b23a1649";
export const FABLE_SLICE_CONTENT_HASH =
  "89f849e23d76ae1e921ecae5f9a3c850d82f5414f6af55ffd46c1ccd6c93ba87";

export interface ContentBundle {
  manifest: Manifest;
  nodes: Node[];
}

// Snapshot imports before any caller receives a mutable bundle. Consumers get
// their own copies; changing one must not change later replay or resume lookup.
const currentSource: ContentBundle = structuredClone({
  manifest: SLICE_MANIFEST,
  nodes: SLICE_NODES,
});
const archivedSource: ContentBundle = structuredClone({
  manifest: ARCHIVED_MANIFEST,
  nodes: ARCHIVED_NODES,
});

async function verified(
  source: ContentBundle,
  expectedHash?: string,
): Promise<ContentBundle & { contentHash: string; manifestHash: string }> {
  // Use the engine's validation, exact manifest membership and canonical node
  // sorting. This registry must not invent a second content-hashing convention.
  const campaign = await createCampaign(
    source.manifest,
    source.nodes,
    "content-registry",
  );
  if (expectedHash && campaign.contentHash !== expectedHash)
    throw new Error("Archived content bundle failed its pinned hash check");
  return {
    ...source,
    contentHash: campaign.contentHash,
    manifestHash: campaign.manifestHash,
  };
}

let bundles: Promise<Map<string, ContentBundle>> | undefined;
function registeredBundles(): Promise<Map<string, ContentBundle>> {
  bundles ??= Promise.all([
    verified(
      structuredClone({ manifest: CAMPAIGN_MANIFEST, nodes: CAMPAIGN_NODES }),
    ),
    verified(currentSource),
    verified(archivedSource, ARCHIVED_SLICE_CONTENT_HASH),
    verified(
      structuredClone({ manifest: GEOMETRIC_MANIFEST, nodes: GEOMETRIC_NODES }),
      GEOMETRIC_SLICE_CONTENT_HASH,
    ),
    verified(
      structuredClone({ manifest: FABLE_MANIFEST, nodes: FABLE_NODES }),
      FABLE_SLICE_CONTENT_HASH,
    ),
  ]).then((entries) => {
    const manifests = new Map<string, string>();
    const result = new Map<string, ContentBundle>();
    for (const entry of entries) {
      const previous = manifests.get(entry.contentHash);
      if (previous && previous !== entry.manifestHash)
        throw new Error("Content hash resolves to conflicting manifests");
      manifests.set(entry.contentHash, entry.manifestHash);
      result.set(entry.contentHash, {
        manifest: entry.manifest,
        nodes: entry.nodes,
      });
    }
    return result;
  });
  return bundles;
}

/** Resolve only bundled, hash-verified v2 content. Replay still verifies the
 * artifact's engine, manifest and complete campaign; lookup never migrates it. */
export async function resolveBundle(
  contentHash: string,
): Promise<ContentBundle> {
  if (typeof contentHash !== "string" || !/^[a-f0-9]{64}$/.test(contentHash))
    throw new Error("Invalid content hash");
  const bundle = (await registeredBundles()).get(contentHash);
  if (!bundle) throw new Error(`Unknown content bundle: ${contentHash}`);
  return structuredClone(bundle);
}
