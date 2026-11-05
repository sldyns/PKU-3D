# Changelog

## 1.5.3

- Reuse bounded, independently fenced instance-buffer stores in Medium/Low, with the original upload path as fallback. Keep the two-frame admission queue and complete ordered instance payloads.
- Prepare exact lower-tier visibility data during idle time in a bounded arena; use the original scalar path for High and unsupported states. Preserve model detail, source images, shadows, reflection settings and antialiasing.
- Retain the matched 192-case input evidence: Medium/Low response P95 was about 13% lower, render-wall time was similar, and all 24 input regression cells passed. This does not pass the study's separate five-percent rendering-gain target or establish stable 60 FPS.
- Keep the additional LOD arithmetic and contiguous-copy candidates experimental after fresh application screens did not establish a consistent gain without tail regressions.
- Avoid checking out the previous generated site during publication and share copied assets where the filesystem supports it.

## 1.5.2

- Refresh the English and Chinese project status, performance documentation and release guidance after reviewing the subsequent rendering experiments.
- Retain the 1.5.1 renderer and complete scene. Visibility, reflection, depth-buffer and worker-rendering candidates remain experimental because repeatable interaction gains without regressions have not been established.
- Publish the matching checksum-pinned asset package and synchronize the displayed and package versions. This maintenance release does not claim a rendering speedup or stable interactive 60 FPS.

## 1.5.1

- Reuse immutable singleton instance bindings, pass-local texture bindings and conservative hierarchical plane results to reduce rendering work.
- Preserve complete model detail, original textures, shadows, reflections, 4× MSAA, ordered instance streams and the two-frame GPU queue.
- Compile deferred scene data separately, omit unused worker descriptor fields and retain place-label focus across view refreshes.
- Refresh the checksum-pinned scene package with the same lossless compressed geometry and offline fallbacks.
- Validate ten exact full-resolution comparisons, context recovery and offline loading, and both original incremental and frozen performance thresholds. Stable interactive 60 FPS remains open.

## 1.5.0

- Keep WebGL 2 as the maintained renderer and High as the fresh-viewer default, preserving the complete model, source textures, shadows, reflections and antialiasing.
- Add road-constrained first-person walking, with restored camera and label preferences on exit.
- Correct repeated wheel zoom input and advance walking input while the bounded GPU queue is full.
- Fit architectural viewpoints around responsive panels and keep place labels aligned with submitted camera poses.
- Reuse conservative visibility and reflection calculations; retain ordered instance streams, two decoding workers, bounded uploads, context recovery and local-file fallbacks.
- Package the matching lossless scene transport and optional Low/Medium presets. Lower presets are explicit quality choices; High keeps the full scene.
- Retain the campus, Student Center, daylight and shoreline refinements in the maintained scene. Stable interactive 60 FPS remains unachieved; see the [performance status](docs/development/performance.md).

## 1.4.0

- Refine campus perimeter walls and gateways, including the South Gate and adjacent station, North Qiu Gate, Southeast Gate and Southwest Gate returns.
- Add the Research Building 1 courtyard entrance and Building 45 bicycle canopy; retain the Research Building 2 glazing grid in aerial views.
- Restore the independent Resource Hotel and the university union Xiaobailou location and building mass, with evidence limits documented.
- Correct Qiu gymnasium roof curves and the two east-west pitches on the East sports field; refine the northern climbing wall and canopy.
- Mark the supported southeast region of 45A basement access without inventing an exact stair or doorway.
- Include the retained atlas input as well as the current output atlas in the asset package, so a fresh checkout can validate and build the delivered scene.
- Publish the matching lossless prebuilt scene and updated portable tests. All six incremental performance checks pass the original thresholds; three original frozen-reference gaps remain unresolved.

## 1.3.0

- Reference-backed campus building, courtyard, entrance and landscape refinements, including Shaoyuan, Yannan Garden and the West Gate.
- Preserve original plaque and sign proportions; repair supported stair, threshold, wall-foot and roof joints without inventing unobserved details.
- Defer unnecessary road mesh construction during cached startup; retain full model detail, original image resolution, shadows, reflections and antialiasing.
- Package the matching prebuilt scene and portable regression fixtures for fresh checkouts.
- Document unresolved model details separately from deferred objects. Three global performance metrics still fail the original frozen comparison; see [performance status](docs/development/performance.md).

## 1.2.0

- Directional sky and ground ambient light for clearer sheltered surfaces; rain and mist attenuate direct sunlight consistently.
- Material-specific rain response for masonry, timber, foliage, glass and metal.
- Calmer bank transitions derived from the mapped outer outline of Weiming Lake, without changing water geometry or inferring depth.
- View-space contact shading and skipped irrelevant backlit shadow lookups retain sample counts, reflection resolution and MSAA.
- Conservatively classified visibility groups and consecutive record copies avoid redundant per-instance work, preserving selection, byte order and compact upload streams.
- Parallel texture/scene loading, shared shader-stage compilation and overlapped visibility preparation shorten serial startup work while keeping two-worker decoding and bounded uploads.

## 1.1.0

- Linear HDR compositing with a single final tone map on supported hardware, preserving the existing MSAA sample count and an 8-bit fallback.
- Stable, filtered tree shadows; denser inner crowns, joined roots and tapered branches.
- Filtered brick, clay, stone and wood surface detail, with restrained dielectric highlights.
- Calmer lake reflections and reflection heights derived from visible water surfaces, including the sunken garden pool.
- Photographic-reference refinements to the 19–21 courtyard windows and steps, Linhuxuan basin and existing lake bridge stonework.

## 1.0.0

- Interactive campus buildings, courtyards, roads and lakes.
- Building search, selection and architectural viewpoints.
- Coordinated 3D and plan views.
- Lighting, seasons, weather, water reflections and pedestrians.
- English and Chinese documentation, contribution guides and separate code/data licenses.
