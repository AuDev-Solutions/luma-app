# Controller output and Fireworks 1D

The user observed a mismatch between the simulated rain and the physical blue strips. Read-only inspection of the real ESP32 confirmed native Rain on both 50-pixel segments, palette 3 and secondary color RGB(9,35,85). The local WLED source (`mode_rain` → `mode_fireworks` → `fade_out`) fades to the secondary color, explaining the continuously blue background. Rain now uses a black secondary color and primary-color palette, including when applying older saved scenes.

LUMA now distinguishes an approximate editable draft from live controller output. It subscribes to [WLED Peek over WebSocket](https://kno.wled.ge/interfaces/websocket/), validates full 1D RGB frames and draws each pixel at its physical index. Live drawing does not use the browser effect simulation or reapply draft brightness. Connection reads recognized controller settings into the editor. Editing switches to draft; confirmed apply returns to live. No GPIO, count or firmware changes.

Stale/disconnected streams show a signal warning without substituting an animation. Explicit reconnect recovers the feed. Hidden pages release the socket; unmount closes it. WLED serves Peek to one client at a time, so simultaneous viewers can lose the stream. RGB data is controller output, not an optical measurement; screen appearance and timing differ from the LEDs.

| Before | After | Why |
| --- | --- | --- |
| Independent simulation remained visible after apply | Controller RGB frames after apply | Display the effect the controller actually generates |
| Rain faded to a blue background | Rain fades to black | Preserve dark space between sparks |
| No distinction between edited and applied output | Borrador / Poste en vivo | Make unsent changes explicit |
| No loss-of-feed state | Warning and explicit reconnect | Avoid presenting stale or invented animation as live |

The user then requested Fireworks 1D. Added it as design 21, using the native named effect, Rainbow palette, black background, 60% segment brightness and 50% speed/gravity parameter. Applied via the LUMA browser button to the real 100-pixel ESP32. Both segments confirmed native Fireworks 1D (ID 90), [0,50) and [50,100), palette 11 and brightness 153. A state backup is held locally in ignored `.local/poste-before-fireworks-1d.json`.

Production build and 15 tests passed, including decoder length/order/black pixels, old rain-background regression, native Fireworks lookup, controller-state hydration and payload confirmation. Real browser integration received 40 distinct 302-byte frames, verified draft→live on apply, showed connection loss after deliberately closing its own socket, and recovered via reconnect. No page errors. Screenshot `output/playwright/fireworks-real-live.png` was visually inspected. The test client closes its socket afterward, leaving the physical effect running and freeing the phone to view Peek.
