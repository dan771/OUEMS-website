# Flicker Lab References

This is research only. The main OUEMS page does not load or use the lab.

## Visual direction

- **Supplied TouchDesigner video (18.4s, 720px square, 30fps)**: the image repeatedly resolves into bright, discontinuous filaments over a mostly black field. The useful cues are abrupt angular changes, short local forks close to an active line, head-adjacent debris, and dim broken interference spread across the frame. Useful takeaway: arrivals should emerge from a point and immediately fragment; the background should feel electrically unstable without becoming a second subject.

- **Ryoji Ikeda, `test pattern`**: binary data made physical through hard black-and-white contrast, repetition, and controlled visual overload. Useful takeaway: the flicker should feel precise and system-like, not like a soft background gradient.
- **James Turrell, Ganzfeld works**: light can become the subject when edges and objects are reduced. Useful takeaway: keep the field quiet around one event of light and let the viewer's eye adapt to it.
- **Light installation / projection studies**: a moving blade, scanline, or horizon creates a sense of physical space with very little geometry. Useful takeaway: a thin bright edge plus a restrained halo is more distinctive than a large glowing blob.
- **Electronic music visualisers**: small timing errors and controlled noise give a signal a human, live quality. Useful takeaway: use layered, seeded flicker so the motion feels volatile but repeatable inside a session.
- **Onformative, generative material and light research** ([onformative.com/work](https://onformative.com/work/)): data-driven pieces often treat the whole frame as active material rather than placing one object in the middle. Useful takeaway: distribute autonomous behavior spatially and let local rules create the composition.
- **Generative Hut** ([generativehut.com](https://www.generativehut.com/)): generative work is an autonomous system rather than a fixed illustration. Useful takeaway: seeded variation, density, and imperfect repetition are part of the visual identity, so avoid evenly spaced particles and obvious primitives.

## What the test script explores

`flicker-lab.html` has three isolated studies:

- **Knife**: a diagonal white blade with an acid edge and a secondary horizon pulse.
- **Static**: sparse data bars, scanlines, and granular interference.
- **Bloom**: a restrained perceptual field with rotating arcs and a central pulse.

The current **Trails** study supersedes the earlier radial version: it uses three long-lived sparks with persistent non-quantized courses and rapid angular bites, fragmented lightning wakes, recursive local branches, head-adjacent debris, and low-alpha broken signal interference. The old regular scanlines, ring geometry, central emitter, smooth clouds, sector-quantized movement, and duplicate spawn-history block have been removed from this mode.

The controls are deliberately exposed so the useful range can be judged before anything is brought into the production page: speed, flicker, density, pointer position, pause, and random seed.