# Rendering performance

## 1.5.4 lossless startup transport

The unchanged complete scene has 99 chunks. Explicitly approved integer delta coding is selected for 70 chunks; one retains the existing modern codec and 28 retain legacy. Selected compressed bytes fall from 100,255,740 to 86,273,657, a 13.95% reduction. Three deterministic packs replace 99 chunk requests. Every original gzip and script fallback remains in the distribution, so archive size and selected network bytes are separate quantities. No geometry, textures, instance order, shadow/reflection resolution or antialiasing settings are reduced. Startup still waits for the complete scene and required rendering resources.

Matched fresh hardware-Chrome runs used High, 1440 × 1000 at DPR 1, two alternating ABBA blocks per profile, the unchanged startup observer and original application fence. The network model applied 300 ms scene-response latency and one shared 4 MiB/s budget. Median first-render completion fell from 26,935.55 to 23,480.8 ms (12.83%); both blocks improved and the original ten-percent network target passed. This is a controlled network model, not a universal public-site loading time or physical presentation measurement.

With local unshaped IO, first-render completion changed from 1,206.5 to 1,256 ms and reported uncollected heap from 154,000,160 to 158,935,941 bytes. Both stayed within their predeclared five-percent limits; local loading is not claimed to be faster. No forced garbage collection or extra GPU fence was used. Direct BYOB reads transfer the final per-chunk buffer rather than accumulating temporary network backing stores; compressed ownership stays bounded and is released after decoding.

Independent checks compared every original decoded byte and compiled instance record for all 99 chunks. Twelve complete RGBA and HDR pairs across High, Medium and Low were byte-identical, with six completed-scene context recoveries. Real-browser failure tests also covered a missing first pack and context loss during headers and body transfer. Local-file loading, disposal and quality persistence passed. These checks cover the stated fixtures and preserve the existing interaction-performance limits below; they do not establish stable 60 FPS.

## 1.5.3 response-focused update

Medium and Low can reuse at most two optional instance-buffer stores per main, shadow and reflection pass, with at most six stores and a shared 64 MiB GPU reservation budget. Each store has explicit reader/fence ownership. Busy, unsupported or failed allocations use the original base buffer; the frame-admission queue remains bounded to two. Complete instance bits, draw order, source images and rendering settings are unchanged. High uses its original upload and selection paths.

Lower-tier visibility preparation uses a separate 16 MiB CPU arena, built cooperatively during idle callbacks. Stored Float32 values are widened for the original Float64 arithmetic; dimensions, ordering and fallback decisions retain their original semantics. High does not prepare an arena. Unsupported states and incomplete preparation use the original scalar selector, and invalidation, disposal and context recovery retire owned work.

The retained complete native-input comparison with unchanged 1.5.2 contains 192 qualified originals in four alternating paired blocks. Medium/Low event-to-render-return P95 had a conservative paired ratio of 0.8694755687, about 13.05% lower. Render-wall median had a ratio of 1.0002454254, effectively unchanged. All 24 input-cell regression checks passed, including the High controls. The original combined acceptance verdict remains negative because it also required at least five percent lower rendering time. This release targets the demonstrated response improvement; it does not retroactively pass that rendering target, measure input-to-photon latency or establish stable interactive 60 FPS.

The same candidate's retained DPR2 qualification includes 141 complete RGBA and 141 HDR rasters, 75 High captures and nine actual context recoveries. Fresh controlled-Chrome checks independently verified 12 exact before/candidate RGBA and HDR pairs across all three qualities, desktop and narrow views, isolation and night lighting. Six actual context recoveries, preset persistence, owned-buffer disposal and local-file loading also passed. These finite fixtures do not certify every campus view or physical phone.

A fresh comparison with the unchanged 1.5.2 build completed all 12 startup/motion stages and passed the six original recheck lines:

| Metric | Candidate/reference ratio | Original result |
| --- | ---: | --- |
| First-frame submission time | 0.96818 | Pass |
| First-frame GPU-ready time | 0.94729 | Pass |
| Reported JavaScript heap | 0.99408 | Pass |
| Campus animation submission rate | 0.99721 | Pass |
| Lake orbit submission rate | 1.01093 | Pass |
| Lake main-thread median time | 0.95489 | Pass |

These controlled samples retain their original viewport, profiling and threshold scope; submission rate is not physical presentation FPS. The separate older-scene historical comparison could not complete within the available resource boundary. No new pass against that older scene is claimed, and its original assets, thresholds and prior results remain unchanged.

Two additional lower-tier LOD variants passed semantic tests and lossless captured-state replay, but their fresh 32-case application screens did not establish a consistent improvement without tail regressions. They are excluded. Their component timing reductions must not be added to the retained response result above.

## 1.5.2 maintenance release

This release updates project status, maintenance guidance and versioned packaging. Rendering behavior and scene content remain those of 1.5.1; only the runtime version identifier changes. It introduces no accepted performance optimization. The retained 1.5.1 results below describe their original build and run, not a new benchmark of 1.5.2.

The subsequent investigations produced isolated implementations and correctness checks, but none established repeatable complete-viewer gains without interaction regressions. Their current disposition is:

| Candidate | Finding and adoption status |
| --- | --- |
| Additional reflection mask | Interaction comparisons had inconsistent gains and regressions in some zoom measurements; not adopted. |
| Group-support visibility, full-instance bindings and strict WebAssembly selection | Group skipping preserved recorded plan output but did not establish a reliable complete-planner improvement; one variant was slower. Binding gains were inconclusive, and WebAssembly had input-response regressions. Not adopted. |
| Removing unused default-framebuffer depth | Repeated submission-rate gains accompanied worse zoom tail spacing. Offscreen scene and shadow depth remained intact, but the interaction no-regression check failed; not adopted. |
| Worker rendering and bitmap publication | Complete-frame ownership and publication were exercised. Main-thread callback improvements did not establish consistent complete-frame throughput gains; not adopted. |
| Submission when GPU capacity and bitmap publication are ready | Implemented in isolation and passed fixed-state image comparisons. Continuous-input performance and native trigger timing remain unverified; not adopted. |

These candidates and their detailed evidence stay in the local research archive. They are not included in the website or asset package. Fixed-state pixel equality does not establish continuous-motion fidelity, lower input latency or stable screen FPS. Submission throughput, main-thread callback cadence and physical presentation must remain separate measurements.

## 1.5.1 renderer integration

The singleton-binding, pass-local texture-binding and hierarchical-plane changes passed 478 JavaScript checks and 19 packaging checks. Ten full-resolution comparisons of the rebuilt package were byte-identical to the preceding maintained build. Picking, walking, quality persistence, a narrow viewport, context recovery and local-file loading also passed.

All 24 original performance stages completed. Both the incremental and unchanged frozen-reference comparisons passed their six original thresholds in the retained run. Trusted-input captures showed lower pan and rotation CPU medians, but no consistent submission-rate improvement; one zoom arm had worse CPU tail latency. These changes reduce rendering work without establishing stable interactive 60 FPS. Historical release measurements below retain their original scope.

## 1.5.0 release validation

The maintained release uses WebGL 2 and starts fresh viewers at High. The slower WebGPU experiment is excluded. Stable interactive 60 FPS remains an open target.

The exact release build passed 452 JavaScript checks and 17 packaging checks. Ten full-resolution fixed-state comparisons against the retained complete-program WebGL build were byte-identical. Trusted picking and walking, explicit quality switching and persistence, a narrow viewport, real WebGL context loss/restoration and local-file loading passed. This covers those fixtures and interactions; it does not certify every campus view or physical phone.

The unchanged frozen-reference protocol completed three alternating pairs under matched browser, renderer, viewport and quality conditions. Five of six checks pass; first-frame submission remains above its original threshold. The reference and current scene differ in retained model content, so these ratios do not isolate an engine-only speedup. No thresholds or frozen assets were replaced.

| Metric | Change from unchanged frozen reference | Result |
| --- | ---: | --- |
| First-frame submission time | +24.393% | Fail |
| GPU-ready time | -3.298% | Pass |
| Reported heap | +7.807% | Pass |
| Campus animation FPS | +5.295% | Pass |
| Lake orbit FPS | +3.095% | Pass |
| Lake main-thread median time | -22.967% | Pass |

Trusted-input measurements used a serial before/release/release/before order, High, the same complete scene and viewport, and no GPU timing queries. The release and retained WebGL build had similar submission cadence; no material speedup is established. These are accepted scene renders per second, not physical screen FPS or input-to-photon latency.

| Input | Retained WebGL | Release WebGL |
| --- | ---: | ---: |
| Left drag | 13.3 | 13.6 |
| Right drag | 12.0 | 12.1 |
| Wheel zoom | 9.4 | 9.6 |

Release P95 submission spacing was about 88 ms, 106 ms and 121 ms respectively, above the 16.7 ms budget. These observations apply to the retained run conditions and do not predict every device.

The historical 1.4.0 table below remains attached to its earlier source/build comparison.

## Retained 1.4.0 reference comparison

The maintained scene retains full model detail, original image resolution, shadows, reflections and antialiasing. The retained comparison covers the research-building entrance and glazing-grid correction, dormitory canopy, Resource Hotel, union building mass, Qiu roof and east sports field. All six incremental checks remain within the original thresholds; three of six checks against the original frozen reference fail. This is not a performance-improvement claim.

| Metric | Change from preceding maintained scene | Change from frozen reference | Frozen result |
| --- | ---: | ---: | --- |
| First-frame submission time | -1.151% | +20.096% | Fail |
| GPU-ready time | -1.345% | -15.200% | Pass |
| Reported heap | +5.488% | +4.893% | Pass |
| Campus FPS | +1.448% | -21.523% | Fail |
| Lake FPS | -1.034% | -26.711% | Fail |
| Lake main-thread median time | -0.847% | -25.595% | Pass |

The incremental result and the three-of-six frozen result remain separate. First-frame submission, campus FPS and lake FPS remained unresolved in that comparison. Both this and the preceding comparison passed three frozen checks; these runs do not establish a causal speedup or slowdown from the geometry changes alone. Heap API precision, shared browser processes and unobserved external GPU activity limit interpretation. All 24 phases completed with stable inputs, the registered environment decision and owned-process cleanup. Values are measurements from the retained comparison, not portable device promises. Physical-phone and whole-campus fidelity acceptance remain open.

The table above belongs to the retained 1.4.0 source/build comparison. It remains unchanged and does not describe later codec or initial-visibility candidates. The latest renderer integration results are recorded in the 1.5.1 section above; 1.5.2 preserves that implementation.

## Delivered cost reductions

- Singleton instance draws can reuse an immutable instance-buffer binding when all 28 words still match the current ordered stream. Grouped draws and changed records keep the ordinary path. The optional buffer is bounded to 4 MiB, falls back on allocation failure and is released with the engine.
- Texture bindings are reused within one draw pass. Sampler uniforms and the active texture unit retain their original behavior; pedestrian and sky callbacks invalidate the local binding snapshot. No binding state survives into another pass.
- Hierarchical visibility traversal carries forward planes whose bounds already prove that descendants cannot be rejected. Final instance selection, ordered streams and conservative fallback rules remain unchanged.
- Cache startup defers the two road meshes until the live builder actually needs them, preserving captured inputs and retry behavior. This removes unnecessary computation; the retained startup median difference of 5.2 ms does not establish a large speedup.
- Prebuilt scene loading retains lossless mesh reuse and compression, checksum verification, two decoding workers, bounded uploads, visibility caches, ordered instance streams, the two-frame GPU queue and idle scheduling.
- Decoder messages carry only the record counts, byte offsets, lengths and detail widths consumed by the worker. The complete manifest remains on the main thread; decoded scene bytes and visibility metadata remain unchanged.
- Deferred builder data, shared geometry pages and conservative visibility handling retain ordinary fallback paths. Context recovery, lazy photos and local-file/offline behavior remain supported.
- Reflection scissoring and conservative reflection culling retain full-resolution targets and fall back where bounds cannot prove a safe restriction.

## User-selectable quality

The viewer offers Low, Medium and High in the lighting panel. New visitors start at High; a valid saved choice is restored on reload and context recovery. High retains the original meshes and rendering settings. Medium and Low retain their existing render-target sizes, source images, 4× MSAA, shadows and reflections, and select prebuilt alternative meshes for supported tree forms and curved roof tiles. Switching preserves the camera and selection; target allocation failure keeps the previous settings.

Lower tiers preserve tree locations and crown envelopes, roof planes, tile courses and ridge geometry. They reduce internal foliage and branch geometry and the subdivisions across tile arcs. Unsupported geometry keeps its original representation. Near or inspected objects use the original mesh; selection thresholds include a hysteresis band. Main, reflected and shadow views select their own detail levels from projected feature size. Reflection selection accounts for the reflected eye and target height; shadow selection uses the light projection and shadow-map size. These are intentional lower-tier approximations, not claims of pixel equivalence.

Alternative mesh resources share the original instance records and conservative visibility bounds. They are baked, decoded and uploaded through the existing scene pipeline, with independent draw bindings and complete disposal. Attach alternatives before initial visibility preparation, include the preset in cache keys, and clear selection history on tier changes. Do not discard complete objects or increase the general-purpose visibility threshold to obtain a lower quality tier.

Performance comparisons against the retained reference must explicitly select High. Lower-tier measurements describe a quality/performance tradeoff and must not be reported as a fidelity-preserving engine optimization. The Engine API retains High as its default; the viewer passes its saved or default High choice explicitly.

## Runtime maintenance contracts

Shader completion may overlap decoding and uploads, but the ready barrier still includes every scene, texture and program resource. Failure cleanup waits for independent work to settle; context loss cancels pending waits. The two-worker decoder and two-frame GPU queue remain bounded. Navigation consumes elapsed input time before the GPU queue check, and reduced-motion preferences disable browse-camera transitions.

The idle-built bucket index requires an Engine-owned epoch. External raw-data or bucket-order edits must invalidate it and refresh derived bounds and visibility caches; uncertain cases retain the original ordered scan. The same epoch owns cached center bounds for small ungrouped buckets. Only a conservative proof that every center lies inside every view plane may skip the repeated instance sphere tests; filters, detail decisions and ordered copying still run normally. Missing or mismatched epochs, displacement, aliases and ambiguous boundaries retain the scalar checks. Water-footprint culling likewise falls back when a safe restriction cannot be established. Reflection descriptor reuse compares the camera matrices, viewport, target and complete consumed water-footprint inputs, including in-place edits. Cached outputs are copied for each caller, and input identities are weak references. Job-owned world caches, replaced helper methods and uncertain descriptors retain the original calculation. Material 0/6/21 specialization preserves the shared sampling and lighting equations.

Pick-range culling requires a build-audited scene descriptor, the qualified browser/GPU profile, unchanged pick shaders and a complete verified scene publication. Qualification runs after rendering and yields during descriptor preparation. Only ranges proven outside the pick region may be omitted; surviving draws retain their original order and streams. Unsupported profiles, incomplete qualification, selected/isolate/explode states and invalidated scene data use the original pick path. Resize and context recovery require fresh qualification. Geometry or bucket mutations invalidate the prepared publication; rebuilding the bucket index alone must not reactivate culling. Keep the profile narrow until equivalent native-pixel and interaction evidence supports an extension.

These paths retain model detail, original image resolution, shadows, reflection resolution and cadence, antialiasing, instance/transparent order, lossless caches and offline/context-recovery behavior. Changing scene inputs still requires `npm run build:scene`; a cached runtime build cannot validate stale geometry.

### Optional transport and initial-visibility candidates

An explicitly imported codec sidecar must match its original manifest/source hash and preserve every raw-byte SHA. Choose alternatives by strictly smaller compressed bytes, not measured timings. The reviewed candidate selects 36 of 94 chunks; all original gzip and script fallbacks remain, including legacy transport for every instance chunk. Keep two workers, one job per worker, one modern-to-legacy retry within that job, and one verified publication. The local-file path remains legacy. Modern decoder and MIT notice travel with the package. A new legacy manifest never activates old optional files merely because they remain in the directory.

Track selected network bytes and retained distribution bytes separately. Keeping legacy assets means the reviewed candidate adds at least 34,728,843 bytes before metadata. Record real fallback behavior and both worker heaps; successful fallback is compatibility evidence, not proof that the modern codec improved startup.

Initial visibility preparation reuses the ordinary CPU stream generator for main/shadow views. Adoption requires the exact camera/state key, viewport and scene generation; otherwise discard and rebuild normally. Idle preparation must not create GL resources, upload buffers or submit draws. Preserve order and all quality settings, cancel invalid work, and account for retained CPU buffers. A final source-built package needs its own functional, pixel, memory and formal performance gates; evidence from an earlier candidate does not certify a changed implementation.

The local early-reflection candidate also prepares the reflection view after the required water resources are published, using exact snapshot and generation checks. Functional, pixel and recovery checks cover that candidate, but it has no completed formal frozen-reference acceptance. The preceding source candidate passed five of six frozen-reference checks; first-frame submission remained above its original threshold. Incremental startup diagnostics do not close that failure or establish sustained FPS or visual improvement. The historical table above remains tied to its original build.

## Validation protocol

Validate modified geometry and interactions in actual desktop and narrow-screen WebGL views. For rendering-path changes, compare matching cameras, state, ordered instance streams and final pixels where equivalence is expected. Include real context recovery and offline loading; unit tests do not replace these checks.

Formal comparisons retain the original 24 stages: three alternating A/B pairs and three alternating frozen-reference/B pairs, with startup and motion recorded separately. Compare matching builds, viewport, browser and quality settings; use the original median formulas and thresholds. Never replace the frozen reference, relax thresholds or repeat unchanged failed candidates to obtain a pass. Preserve source identity, raw samples, failed attempts and cleanup receipts in the local evidence archive.

For continuous-input comparisons, record the actual native pixel ratio, viewport, input delivery, controller consumption, submitted camera and complete render work. An identical command plan does not prove identical submitted camera paths. Keep native and overridden pixel ratios distinct, qualify input before timing, and report every direction's spacing and input-response tails alongside aggregate throughput. Removing diagnostic observers requires a separate equivalence check. An aggregate gain cannot override a repeated directional regression.

Worker or readiness-driven scheduling must preserve the original input clock, bounded GPU queue and ownership of each complete frame. Match rendered camera state, bitmap publication and label updates through resize, interruption and context recovery. A fixed-view comparison or a faster main-thread callback does not certify this lifecycle or visible interaction speed.

The original frozen bundle and machine-specific measurement harness are not distributed as public product assets. A fresh checkout can run the portable tests and the exact packaged scene, but cannot independently reproduce the historical table without that retained measurement archive.

## Candidates not adopted

| Direction | Reason for stopping |
| --- | --- |
| Deferred decorative strokes | Formal incremental comparison failed the reported-heap limit. |
| Immutable texture-array storage | Texture mip and scene comparisons passed, but startup differences were near zero and inconsistent across pairs. |
| Lossless binary encoding of range metadata | Reduced script bytes, but all seven offline compilation/execution pairs were slower; no browser performance claim. |
| Repeated mesh positions and large ceramic-tile indexing | Insufficient supported reuse to justify implementation. |

These investigations are not delivered optimizations. Detailed chronological reports and intermediate captures remain local. New candidates need a substantive change or new evidence before further testing.
