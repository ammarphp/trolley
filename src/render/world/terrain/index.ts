/**
 * Ground and water for the ink world.
 *
 *   const ground = createGround({ seed });   // add ground.object under the offset world root (or the scene)
 *   ground.update(dt, env, rigWorld, camera); // each frame, after the floating origin is set
 *   ground.heightAt(x, z)                    // absolute world metres
 *
 *   const river = createRiver({ points: [[x0, z0], [x1, z1], ...] });
 */
export { createGround, GROUND_LATTICE, type GroundModule, type GroundOptions } from "./ground.ts";
export { createRiver, type RiverModule, type RiverOptions } from "./river.ts";
export { heightAt, slopeAt, normalAt, syncTerrainOrigin, TERRAIN_GLSL, TERRAIN_UNIFORMS, TERRAIN_WAVES, TERRAIN_MAX_HEIGHT } from "./height.ts";
export { buildNestedGrid } from "./grid.ts";
export { INK2D_GLSL, SKY_OUT_GLSL, SKY_LOOK_UNIFORMS, setSkyLook, syncSkyLook, COMPOSITE_FADE } from "./glsl.ts";
export { createInkLambert, trackPixelScale } from "./ink-lambert.ts";
