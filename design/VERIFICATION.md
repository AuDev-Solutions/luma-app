# Visual and functional verification

Verified 2026-09-29 using Playwright Chromium. Browser/IAB was attempted first but returned `Browser is not available: iab`.

## Visual comparison

Concept `concept.png` and final `desktop.png` / `mobile.png` were opened together with `view_image`. Desktop viewport 1504×1044 (concept approximately 1504×1044); screenshots include full page content. Mobile screenshots use a 390×844 viewport. Additional overflow checks at 320 and 768 CSS pixels passed.

| Comparison | Observation and resolution |
|---|---|
| Composition | Two-column preview/editor, header and restrained footer retained. Desktop top spacing and column proportions tightened after initial capture. |
| Palette | Graphite surfaces, ivory text and lime selection/action color match the reference direction. |
| Typography | Local Manrope and DM Sans; title, section, control and supporting text hierarchy checked. Card descriptions enlarged on desktop after first pass. |
| Controls | Six selectable scene tiles, round color wells, slim sliders, face selection and paired actions retained. Range hit areas increased to 22px. |
| Visualization | Discrete pixels, metal channels, grid floor, labels and dimension retained in a live canvas. It is intentionally procedural and less photorealistic than the concept. |
| Copy | Core title, subtitle, scene names, section labels and save label retained. Explicit product corrections documented in DESIGN.md: demonstration CTA, edit target, real dimensions, local storage. No unexplained copy drift. |
| Responsive | Preview stacks above editor on mobile. No horizontal overflow at 320/390/768px. Desktop controls remain fully accessible through ordinary page scrolling. |

Visual direction faithfully implemented with the documented functional corrections; the procedural preview is not a pixel-identical raster reproduction. No clipping or broken layouts observed.

## Functional checks

- Production build passes.
- Six Node tests pass: RGB/effect mapping; segment bounds; unsupported effects; zero brightness; stored data/address validation; bounded preview values; mocked read/write API sequence.
- Browser flow passed: pause; edit only B; select solid effect; brightness 32%; save; reload; restore independent A/B values; delete test scene; switch to 400 pixels; reject malformed connection address.
- No JavaScript page errors during the flow.
- Test flow used an isolated browser context and left the user's active demonstration untouched.

## Remaining integration work

No physical ESP32 was connected during verification. Firmware flashing, GPIO assignment, current limiting, exact physical effect fidelity, Wi-Fi provisioning, embedded hosting and boot presets remain hardware/deployment work. Saved scenes are browser-local and apply is an explicit action. No claim of a physical connection is shown without a successful API response.

## Hardware follow-up · 2026-09-29

The initial no-hardware limitation above was resolved for API control in a subsequent session. Read the user's ESP32-S3 (WLED 17.0.0-devV5, ESP32-S3_16MB_opi, 100 LEDs). It had the default single segment [0,100), which the first app version rejected. Fixed first-apply setup to split this conventional default layout into [0,50) and [50,100); custom/overlapping layouts remain protected. No GPIO or LED count changes.

The real firmware does not list Comet, so Ascenso now uses Meteor when Comet is unavailable. Applied the user's selected Ascenso scene through the real LUMA browser button and received the message “Escena aplicada y confirmada por WLED.” The app verifies the controller state after posting before reporting success. Optical output still requires the user's observation.

Nine automated tests pass, covering the default layout regression, Meteor fallback and rejection of silently ignored changes. A local pre-change state backup is kept in the ignored `.local/` folder. Error notifications now persist until dismissed.

## Single-strip correction

User clarified that only one 50-pixel string is physically connected. Added explicit 50/100/400 total-pixel mount definitions. The 50-pixel mount renders only face A, hides two-face controls, and sends only segment 0; latent face-B scene data is retained for future two-face use but never transmitted for this mount.

Backed up LED configuration/state locally, then adjusted the real controller output from 100 to 50 while retaining its existing GPIO 17, LED type and electrical settings. Confirmed `info.leds.count=50` and one segment [0,50). Ten unit tests and production build pass. Playwright at 390×844 accessed LUMA through its LAN address, connected to the real 50-pixel ESP32, confirmed single-strip UI and no horizontal overflow. Screenshot `mobile-single-strip.png` visually inspected with view_image.

## Current mount and 20-design collection · 2026-09-29

The user subsequently confirmed two strings in series, 100 total. Hardware was returned to 100 during that session; this expansion defaults the simulator to 100 as well. Connection still detects 50, 100 or 400 from the device.

Production build succeeds; 12 automated tests pass, including every curated preset, color/intensity bounds at 200 pixels per face, palette selection, Meteor compatibility, layout protection and refusal to confirm ignored settings. Browser scripts live in `output/playwright/` and run through Playwright CLI. No new runtime dependencies.

Verified with isolated browser contexts: selecting all 20 designs; accent-insensitive search; empty search/favorites states; favorite persistence after reload; slider changes; spectrum-specific controls; static-effect speed disabled; local scene saving; simulator apply; 100/400 layouts; no page errors. No horizontal overflow at 320, 360, 390, 768 or 1440 pixel viewports. Captured and visually inspected `output/playwright/gallery-mobile.png` and `gallery-desktop.png`. Mobile preview and action dock remain visible while browsing.

### Rendering measurements

Desktop Chromium with a 390×844 viewport, DPR 2; these are not physical phone measurements. The renderer targets at most roughly 60 fps instead of following high-refresh screens without a limit.

| Measurement | Before optimization | Final collection |
| --- | --- | --- |
| 100 pixels, 2 seconds | 58 frames; 6,264 gradients | 120 frames; 0 gradients |
| 400 pixels, 2 seconds | Not measured | 118 frames; 0 gradients |
| Paused, 1 second | 28 frames; 3,024 gradients | 0 frames; 0 gradients |
| Solid, 1 second | Not measured | 0 frames; 0 gradients |
| JavaScript | Development resources ~2.18 MB | Production bundle 260.55 kB raw / 83.30 kB gzip |

Gradient construction occurs when building the cached scene, outside steady-state frame samples. Bundle sizes come from Vite output; browser resource timing returned zero for cached resources and was not used as a download-size measurement. Initial font downloads are separate. Canvas appearance remains approximate.

The physical ESP32 did not respond at its last IP during this expansion. No new effects were sent to real hardware during these checks. Optical fidelity and actual phone speed still require on-device observation. Research, complete catalog and Before/After UI review: `EFFECTS-RESEARCH.md`.

## Mobile LED visibility correction

Follow-up proportion adjustment: user requested a taller inline mobile preview with thinner poles. Canvas height now spans 300–380 CSS px (43svh), measuring 362.9 px at 390×844, versus 253.2 previously. Narrow-screen pole width changed from 28 to 19 px and light marks from 12 to 8 px. Narrow layouts devote more height to the LEDs. Scroll padding keeps focused gallery controls clear of the larger sticky preview and bottom actions; short screens use normal document flow. Production build and `verify-mobile-detail.js` passed; inspected the refreshed inline screenshot. Detail view, face selection, playback and focus restoration remain functional.

User reported that the mobile lights were indistinct compared with desktop. In the 185 px mobile canvas, LED radii were subpixel while every glow still extended 24 px, blending neighbouring colors. The mobile rendering now emphasizes each LED horizontally while preserving its vertical position and restricting glow to the local spacing. Sprite textures are cached at 2× and the canvas uses up to 2× device resolution.

| Before | After | Why |
| --- | --- | --- |
| 185 px mobile preview; tiny points | Responsive 225–260 px preview; 12 px wide light marks | Make each color visible on narrow screens |
| 24 px halo blended adjacent LEDs | Short vertical glow follows LED spacing | Preserve dark gaps, trails and color bands |
| 1.5× canvas with small sprite cores | 2× canvas and sprite cache | Sharper colored edges |
| Expansion depended on browser fullscreen support | Accessible enlarged dialog with shared pause and face controls | Inspect detail on mobile; restore focus when closing |

Production build passed. `verify-mobile-detail.js` passed in Chromium touch/mobile emulation at 390×844, DPR 3: inline canvas 253.2 CSS px high, enlarged canvas 574 px high, correct shared pause state, face selection, close/Escape and restored focus. Checked 100 and 400 pixels, 320×640 and landscape 844×390 without horizontal overflow or page errors. Visually inspected `mobile-detail-inline.png`, `mobile-detail-expanded.png` and `mobile-detail-400.png` in `output/playwright/`. Actual phone optical appearance still requires user observation. No controller settings or brightness values changed.
