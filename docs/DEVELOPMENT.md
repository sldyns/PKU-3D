# Development

[中文](DEVELOPMENT.zh-CN.md)

## Run locally

Requires Python 3.10+, Node.js 20+ and a browser with WebGL 2. Google Chrome is needed to regenerate the scene cache.

```sh
git clone https://github.com/sldyns/PKU-3D.git
cd PKU-3D
npm install
npm run setup
npm run build
npm run dev
```

`setup` downloads the versioned scene and texture package from GitHub Releases and checks its hashes. `build` creates `dist/` from the matching scene cache. Open the local URL printed by `dev`.

## Layout

| Directory | Contents |
| --- | --- |
| `app/src/` | Rendering, building models and interaction |
| `app/data/` | Editable campus data and scene metadata |
| `app/tools/` | Scene baking |
| `app/tests/` | Runtime regression checks |
| `scripts/` | Asset setup, local server and packaging |
| `docs/` | Documentation and rendered screenshots |
| `dist/` | Generated website; excluded from Git |

The renderer retains some numbered internal module names to preserve cache compatibility. These are implementation identifiers; the release version is defined in `VERSION`.

## Edit and verify

For interface and documentation changes, use `npm run build`. After changing buildings, vegetation or other scene inputs, use `npm run build:scene` to regenerate the cache. Check affected buildings and interactions in the browser.

`npm test` runs the explicit portable suite in `app/tests/suite.json`, covering decoding, instance transfer, visibility, draw reuse and selected model repairs. See [test scope and historical checks](development/testing.md). Visual review and performance comparisons remain separate checks; see [Performance](development/performance.md).

Directional building views fit the eight envelope corners using the current yaw, elevation, perspective and visible space beside or above the detail panel. Point-mapped gates use their declared display extent. Keep the camera offset and framing calculation consistent; a universal mobile distance multiplier cannot fit both long side elevations and roof views. Mapped envelopes may omit projecting sculptures or boundary walls, so inspect those separately rather than claiming the envelope is a surveyed model boundary.

Angle actions compact the place card on narrow screens and short landscape windows, retaining its title, view controls and an explicit way to reopen the information. Fit the camera after this layout change. Preserve keyboard focus and restore the full card when selecting a place or leaving the compact browsing context.

World labels follow each camera pose actually submitted to the renderer. Refresh them for camera motion only after the GPU queue accepts the frame, retain the idle cadence when the camera is unchanged, and calculate label placement before applying label DOM updates. Keep surviving labels visible while reading panel bounds so layout reads do not hide the focused label. Hide only labels that leave the chosen set, and write visibility, position and current-selection attributes only when their values change. Read live feature and panel data on each call; do not retain a cache that can become stale after a public data mutation.

## Maintained renderer and quality

The released viewer uses WebGL 2. Fresh viewers start at High; valid saved quality choices are restored. High keeps the complete meshes, original source textures, shadow and reflection targets, and four MSAA samples on the supported profile. Low and Medium are explicit alternatives in the lighting panel; their lower detail and target settings are quality tradeoffs. They are not evidence of a fidelity-preserving speedup.

The slower WebGPU experiment is excluded from the release. Keep research results and intermediate captures in the local archive. A lower isolated GPU interval does not establish a complete-viewer improvement or stable interactive 60 FPS.

## First-person navigation

The navigation controller in `app-v29.js` projects the starting point onto the existing road graph. Manual movement stays within the connected road corridors and rejects mapped building footprints. These footprint checks do not model every wall, tree, stair or gate. Route playback uses the same graph, stops at overlapping building footprints, and never creates links between disconnected roads. Eye height follows the landscape at 1.68 metres; exit restores the previous camera and label preference. Input is cleared on focus loss, page hiding and WebGL context loss. Navigation changes do not alter the baked scene.

Advance first-person input and route playback on visible animation frames before checking the two-frame GPU submission limit. Retain the bounded elapsed-time cap, movement substeps and input-clock reset on interruption; a full GPU queue must not discard ordinary movement time. Browse-camera transitions honor `prefers-reduced-motion` and use immediate framing when reduced motion is requested.

Repeated wheel input integrates each zoom goal from its input time, using one pending camera pose between accepted renders. Publish that pose only when rendering advances the browse camera. Reversal and cancellation retain the last displayed pose as their anchor; a pending pose must not move the camera when a drag interrupts zooming.

## Rendering

Surface lighting, reflected color, fog, glass and particles share a linear HDR target when half-float color rendering supports the existing MSAA sample count. The final composite applies contact shading and tone mapping once. Other devices retain the 8-bit target and antialiasing; reflection sampling reverses the display map before mixing light.

Water surfaces are horizontal meshes. Their transformed bounds supply the reflection plane; the selected or nearest visible surface determines the single planar reflection target. Simultaneously visible water at different heights still shares that target. High-quality tree rendering specializes the same material equations without removing leaves or changing their order. Medium and Low can select separately baked tree and roof-tile meshes while retaining original geometry for close inspection; see the [quality policy](development/performance.md#user-selectable-quality).

`material-detail.js`, `water-detail.js`, `quality-lod.js` and the pedestrian runtime do not contribute static scene geometry and are excluded from the scene-input digest. Building, vegetation and landscape edits, including alternative mesh generation, still require a scene rebuild.

The water-bank field is regenerated by `tools/build-water-detail.py` during builds. It stores distance to the mapped outer shoreline of Weiming Lake; island banks and other water bodies keep their existing treatment. It is not a bathymetric model. Its source geometry and generator are hashed to prevent stale fields.

Contact shading reconstructs view-space positions from the actual asymmetric projection. Its sample pattern is unchanged. Surface normals choose sky/ground ambient light, while rain response varies by material and orientation; this does not model detailed rain shelter.

The seven-millisecond upload budget carries across decoded chunks, including index buffers, avoiding redundant chunk-end animation frames. Shader readiness polling through `KHR_parallel_shader_compile` overlaps texture loading, two-worker decoding and bounded uploads. Query compile/link results only after completion; browsers without the extension retain synchronous validation. Keep the full readiness barrier: materials, scan textures, scene resources and shader programs must all settle before readiness or failure cleanup. Timeout, disposal and context loss cancel pending shader waits and release temporary stages; restoration creates fresh resources. Instance visibility metadata is prepared as decoded chunks arrive, and final readiness still validates every mesh buffer.

After resolving multisample color and depth into the post-processing textures, the renderer invalidates only the transient multisample attachments. The resolved textures, sample count, contact shading and reflection targets remain intact; the next scene pass clears depth and redraws the sky. This follows the [WebGL 2 framebuffer invalidation contract](https://registry.khronos.org/webgl/specs/2.0/#3.7.4).

The reflection pass also invalidates its depth renderbuffer after drawing. Reflection color stays valid for later sampling, while depth is cleared before every reflection redraw. Never invalidate the shadow depth texture or the resolved scene depth before its post-processing consumer.

Main and reflection passes draw the far-depth sky after opaque geometry and people, but before transparent panes. The unchanged `LEQUAL` depth test rejects sky samples already covered by opaque surfaces. Keep the sky depth writes disabled and the transparent ordering intact, including empty or entirely transparent scenes. `state.skyAfterOpaque = false` retains the former ordering for same-camera pixel comparisons; it does not change sky quality.

Reflection visibility uses the water sampling scissor as a conservative culling frustum, with an additional one-texel guard. Only the CPU culling planes change: raster projection, mesh data, materials and detail thresholds remain unchanged. The scissor participates in the reflection visibility cache key and is cleared after the reflection pass. Missing bounds retain the full frustum. `state.reflectionFrustum = false` retains full-frustum submission for same-camera comparisons; the scissor itself has a separate diagnostic switch.

Dedicated opaque routes for materials 0, 6 and 21 specialize the shared shader without changing texture sampling, derivative filtering, material formulas or instance order. Mixed-material and unsupported buckets retain their ordinary route. Keep shader readiness and cleanup lists aligned with every specialized program.

The bucket spatial index is built incrementally during idle time for Engine-owned geometry under an explicit epoch. Until it is ready, unsupported or uncertain data uses the existing ordered scan. External writes to raw instance arrays, compiled bounds, or bucket Map membership/order must call `invalidateBucketIndex()` before mutation, then refresh derived visibility data and caches before rendering; identity or Map size alone does not prove that an index is current. Public mutable Maps do not acquire an index implicitly.

Water-footprint culling derives conservative bounds from supported static horizontal surfaces without changing their geometry. Missing metadata, animation, mixed materials, unsupported transforms or ambiguous projection keep the existing conservative reflection path. Preserve ripple/filter margins, reflection target size, update cadence and transparent ordering.

Prepared caches keep vertex, 16-bit index and 32-bit index streams in separate chunk groups so lossless byte shuffling remains aligned. Mesh and instance ordering stays intact. Unchanged glyph drawing inputs reuse a checksum-verified atlas during subsequent bakes.

Prepared-scene decoding interleaves instance-bearing chunks with mesh-only chunks, starting larger instance chunks early so CPU visibility preparation can overlap subsequent decoding and uploads. The manifest still creates buckets in their original order; decoded records are assigned by key, without reordering their bytes. Keep two workers, one pending decode per worker, checksum verification, local-file fallbacks and the existing seven-millisecond upload yield budget.

Visible instance records are gathered in consecutive spans using typed-array copies. A group skips per-instance checks only when its conservative bounds and minimum and maximum detail sizes prove every record passes or fails the unchanged thresholds; isolation, vegetation hiding and route filtering retain individual checks. Ambiguous groups use the existing tests. Gaps terminate a copy span, and buffer growth preserves earlier records and pending spans.

## Optional codec and first-frame preparation contracts

The generated website separates the campus, architecture archive, scene manifest and pick descriptors into four data-only classic scripts, deferred in order before the application. This lets the browser compile data and application code independently. The application takes each value at its original initialization position and deletes the temporary staging object. Keep literal syntax, original numeric text, signed zero, member order and executable data adapters intact; wrapping these payloads in `JSON.parse` adds large string allocations. The full source manifests remain the cache authorities, and startup still waits for every scene and rendering resource. Include all data scripts in release hashes and total script-byte accounting.

The optional scene codec is admitted only through an explicitly approved sidecar tied to the exact baked manifest and source hash. Select `gzip-meshopt-attributes-v1` only when its compressed bytes are strictly smaller; equal or larger alternatives keep the original representation. The reviewed 94-chunk candidate selects 36 alternatives (30 vertex and six index chunks); all 94 original gzip files and script fallbacks remain available, and all 11 instance chunks retain their original transport. These counts describe that candidate, not constants for future scenes. Admission retains original raw-byte SHA checks and generation's full-byte proof, without changing mesh/instance order, padding, atlas pixels or scene quality.

Keep exactly two scene workers and one pending job per worker. Within one worker message, try the modern representation and, on failure, retry the same chunk through legacy at most once; publish exactly one verified result. A legacy failure remains terminal. Do not add a worker pool, cross-job retry or HTTP-to-script recovery policy. Local `file://` loading uses the original script-embedded gzip. The official decoder and its MIT notice are real local package files; there is no remote decoder bootstrap. Preserve existing disposal and context-restoration behavior.

Feed the compressed byte view directly into the native gzip stream and keep it immutable until decompression completes. Preserve gzip error handling, decoded length checks, raw-byte checksums and the existing fallback boundaries. Worker VM tests must provide the same stream globals as the browser.

Sidecar import must reject a mismatched parent manifest, source package, asset checksum or resource path before accepting metadata. Build projection keeps optional codec fields while removing only the existing bucket audit hashes. Build and archive dependency lists come from the explicit manifest, never a directory scan. A newly baked manifest without the extension loads legacy even if unused modern files remain on disk; an old sidecar cannot be imported into a different bake. Unchanged-input cache reuse may retain an already valid extension. Include both transports, decoder and license in archive restoration checks. Smaller selected network payload does not imply smaller distribution: this candidate adds 34,728,843 bytes of alternative payloads, decoder and notice before metadata, while keeping all legacy files.

Initial visibility preparation is CPU-only work split across idle callbacks. Its time budget is checked between work units and is not a hard per-callback deadline. It reuses the normal visibility/ordered-instance-stream generator for the main and shadow views, with copied camera and mutable state inputs; it does not generate a second culling algorithm. Adopt a prepared plan only when the complete view/state key, viewport and engine generation match exactly. Discard stale or unfinished work and use the ordinary path; mutations, recompilation, disposal and context loss must not leave an adoptable old plan. Real rendering remains the only owner of VAO creation, GL uploads and draw submission. No additional GL work, reduced detail, lower resolutions, shortened draw distance or altered shadow/reflection/antialiasing settings are permitted. Functional and pixel checks do not replace the formal startup, memory and frame-time comparison.

Early reflection preparation uses the same ordered CPU stream generator after every required water resource has been successfully published. Its snapshot includes both camera matrices, water level, reflection target and culling switches. A changed publication, resource identity or input discards the reflection plan without invalidating a still-valid main/shadow plan. The first actual render stops queued preparation, adopts only exact matches and releases retained CPU arrays; it remains the sole owner of GL uploads and submission.

## Release

Keep `VERSION`, package metadata and displayed version information in sync. Build the scene when needed, then run `npm run assets:pack` and attach the archive to the matching GitHub release.

Separate maintenance releases from renderer changes. A version-only runtime edit can be verified by comparing generated files with the preceding release while accounting for the exact version strings, content-derived bundle name and build metadata. Verify the packaged assets and a clean source build as well. This check does not certify an experimental renderer or replace its visual, lifecycle and performance gates. Release notes must distinguish newly measured results from retained historical evidence.

Run `npm run deploy` to build and push the generated website to `gh-pages`. GitHub Pages publishes that branch at `https://sldyns.github.io/PKU-3D/`. The `main` branch contains the editable source; `gh-pages` contains only the generated website. Publishing requires Git push access to this repository.

The publisher clones the generated branch without checking out its old files and uses filesystem copy-on-write where supported, with ordinary copies as a portable fallback. It still stages the complete generated tree, so files removed from the build are removed from the published site.

## Local reference material

Development photographs, videos and research records are excluded from Git and release packages. In a maintainer workspace that already has these files, `npm run dev:references` serves the local source; add `?dev=1` to display building references. This mode is restricted to local hosts and is unavailable on GitHub Pages.
反射通道可根据可见水面在反射投影中的保守包围范围设置 scissor，避免绘制不会被水面采样的区域。预建网格只增加静态水面的局部包围盒元数据，顶点、实例与压缩块保持原样。边界包含最大波纹采样偏移和双线性过滤余量；穿过视点平面、混合材质、动画水面或缺少边界元数据时回退到完整反射。反射尺寸、更新频率、阴影和抗锯齿保持不变，`state.reflectionScissor=false` 可用于同视角对照。

## Model status and audits

See [campus building and sports details](development/campus-details.md) for research-building entrances, dormitory canopies and basement access, the union building, Resource Hotel, Qiu roof and East sports field.

See [campus perimeter](development/perimeter.md) for the wall, street frontage and entrance distinctions, source views and remaining boundary gaps.

See [model status and reference gaps](development/model-status.md) for the delivered scope, named unresolved details and deferred objects. Partial repairs are not whole-building acceptance. Chronological research notes and machine-specific performance records remain in the local evidence archive.

Run `npm run audit:entrances` to compare actual baked building dispatch with the architecture inventory. It checks the scene source hash and rejects stale caches or duplicate IDs. Renderer presence does not establish entrance fidelity; photographic registration and visual inspection remain separate requirements.

For a source adapter that scales an existing entrance below its low-geometry cutoff, `retainLowKeys` can preserve explicitly named original threshold or stair records. It bypasses only that height filter: footprint bounds, clipping, transforms and all other records keep their usual path. Scope the key list to the affected source call; never disable filtering or clipping for an entire campus group to recover two entrance parts.

A building may declare `backObservation46` for a registered rear entrance, using the same validated target, bounds, yaw and elevation as `frontObservation46`. Only the rear button uses it; front, side, roof and isolated whole-building views retain their own framing. Invalid or incomplete metadata falls back to the ordinary full-building rear view. Check the approach, surrounding occlusion and actual mobile panel when adding an entrance target.

Consecutive subdivisions of one original fence segment may reuse an identical endpoint post. Reuse requires the same geometry object and key, contiguous endpoints, and bit-identical complete Float32 instance records. Different paths, corners, materials, metadata and transforms remain separate. This is scene-generation deduplication; it does not change visibility thresholds, fence openings or runtime draw ordering.

Static shared pages retain independent logical meshes and merge only contiguous visible opaque geometry with identical instance bytes and shader routes. Changed geometry or unsupported layouts fall back to ordinary uploads and draws. The portable regression is `app/tests/shared-pages208.test.cjs`; its small historical fixture must not be automatically updated after a failure. `app/tools/update-shared-pages208-fixture.cjs` defaults to a read-only check; reviewed fixture updates use `--write`. Runtime Engine changes use the cached build and still require rendered, offline, context recovery and unchanged performance checks.
