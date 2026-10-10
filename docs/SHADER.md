# Animated water-plane background

## Library verification

- Package: `@shadergradient/react` **2.4.20** (npm), ESM, peer `react ^18.2 || ^19`.
- Runtime imports (checked in `dist/*.mjs`): `react`, `three`, `@react-three/fiber`. `camera-controls` is bundled inside the package; `three-stdlib` is not imported, so neither is installed separately.
- Installed alongside: `three@0.186`, `@react-three/fiber@9` (the React 19 line).
- Exports used: `ShaderGradientCanvas`, `ShaderGradient`, type `GradientT`.

## Parameters

The supplied configuration is stored verbatim in `apps/web/src/components/background/shaderConfig.ts` (`SHADER_CONFIG`). How each value is applied:

| Parameters | Applied to | Reason |
| --- | --- | --- |
| `type, animate, shader, uTime, uSpeed, uStrength, uDensity, uFrequency, uAmplitude, range, rangeStart, rangeEnd, positionX/Y/Z, rotationX/Y/Z, color1/2/3, reflection, wireframe, cAzimuthAngle, cPolarAngle, cDistance, cameraZoom, lightType, brightness, envPreset, grain` | `<ShaderGradient>` unchanged (`control="props"`) | Part of `GradientT` |
| `pixelDensity`, `fov` | `<ShaderGradientCanvas>` | They are canvas props in this version |
| `bgColor1`, `bgColor2` | Background colour of the fixed container (`#000000`) | The canvas is transparent |
| `axesHelper`, `gizmoHelper`, `destination`, `embedMode`, `format`, `frameRate` | Not passed | Settings of the shadergradient.co customiser and GIF exporter; not accepted by the React component and without effect on a live canvas |

`envPreset: "city"` only takes effect when `lightType` is `"env"`. With `lightType: "3d"` (as supplied) the library uses an ambient light and requests no HDR file, so the background makes **no third-party network requests**.

No visual parameter was changed. The only runtime override is `animate`, which is set to `"off"` while the browser tab is hidden to stop GPU work in the background.

## Integration

- `ShaderBackground` is mounted once in the root route. Route changes do not re-create the WebGL context.
- `ShaderCanvas` (the only module importing three.js) is lazy-loaded into its own chunk (~1.15 MB minified, ~288 kB gzip) after first paint.
- The layer is `position: fixed`, `z-index: -10`, `pointer-events: none`, `aria-hidden`, and the canvas is created with `pointerEvents="none"` and `powerPreference="low-power"`.
- Readability: a scrim darkens the water behind text. On signed-in pages the water shows through only in the page “horizon”; forms, tables, charts and dialogs sit on opaque surfaces.

## Fallback

A static CSS rendition of the palette (`.water-fallback`) is used when:

1. `prefers-reduced-motion: reduce` is set (live: changing the OS setting switches immediately),
2. WebGL (`webgl2` or `webgl`) is unavailable,
3. the renderer throws (error boundary), or
4. the user turns the animation off in **Settings → Display** (stored per device).

All workflows function identically with the fallback; tests in `ShaderBackground.test.tsx` cover the fallback decisions and that every supplied visual parameter reaches the component.

## Verification performed

A production build served by the API, with its Content-Security-Policy, was loaded in headless Chromium (SwiftShader WebGL): the background reported `data-mode="shader"`, one canvas was created, and the console had no errors. Visual results were checked in screenshots at 1440×900 and 390×844. Frame rate on real GPUs and low-end phones was not measured.
