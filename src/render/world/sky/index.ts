/**
 * Sky, clouds, backdrop and weather for the ink world.
 *
 *   const sky = createSky({ seed });          // scene root
 *   const weather = createWeather({ seed });  // scene root
 *   weather.onLightning((s) => flash(s));     // not called when noFlashing
 *   each frame: sky.update(dt, env, rigWorld, camera); weather.update(...)
 */
export { createSky, type SkyModule, type SkyOptions } from "./sky.ts";
export { createWeather, boltPath, setGlobalNoFlashing, type WeatherModule, type WeatherOptions, type LightningEvent } from "./weather.ts";
export { createSkyDome, type SkyDome, type SkyDomeState } from "./dome.ts";
export { createCloudField, cloudGeometry, createCloudMaterial, type CloudField, type CloudKind, type CloudState } from "./clouds.ts";
export { createBackdrop, SKYLINE_KINDS, type Backdrop, type BackdropState } from "./backdrop.ts";
export { skylineElement, type SkylineKind } from "./skyline.ts";
export { sunDirection, nightAmount, findKeyLight, lightDirection } from "./sun.ts";
export { setSkyLook } from "../terrain/glsl.ts";
export { heightAt } from "../terrain/height.ts";
