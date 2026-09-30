# LUMA design reference

Reference: `concept.png`, generated using the built-in Image Gen tool. Name LUMA is a provisional product identity.

Brief: Spanish local LED pole controller, graphite surfaces (#101214 / #191c1f), lime accent (#d9fc85), ivory text, two vertical LED faces in a procedural preview, six curated effects, color and motion controls. Complete compact desktop screen and stacked mobile adaptation. All product controls and visualization are live code, not an embedded screenshot.

Typography: Manrope headings; DM Sans controls. Rounded 16px panels, 10px tiles, thin muted borders, restrained line icons. Local fonts are preferred for the offline build.

Intentional corrections/extensions to generated concept:
- Prototype span is 1.96 m (50 pixels spaced 4 cm), full span is 7.96 m. Generated dimensions were incorrect.
- A/B are two faces of one pole, displayed separately for inspection.
- “Editar caras” clarifies which preview is edited. Applying transmits the complete draft.
- Disconnected action is “Probar escena”, avoiding a false claim that a device is connected.
- “Mi montaje” provides required 100/400 pixel selection.
- Saved scenes are browser-local, explicitly labeled. Boot presets and firmware hosting are not implemented.
- Simulation is approximate, not a pixel-identical reproduction of WLED algorithms.

Implementation: React/Vite, focused canvas, scene controls, modal, state/API modules. Canvas LEDs are a data visualization, intentionally procedural. No raster imagery is needed at runtime.
