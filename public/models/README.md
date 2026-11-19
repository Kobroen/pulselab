# Modeller

Modellene ligger i kodelageret slik at testsiden ikke henter noe fra tredjepart.

| Fil | Modell | Kilde | Lisens |
|---|---|---|---|
| `pose_landmarker_lite.task` | MediaPipe Pose Landmarker (lite, float16) | Googles offisielle modellager for MediaPipe | Apache 2.0 |
| `movenet-lightning.json` / `.bin` | MoveNet SinglePose Lightning v4, TF.js-format | npm-pakken `@vladmandic/human-models` 3.0.4, konvertert fra Googles TF Hub-modell | Apache 2.0 (modell), MIT (pakke) |

MoveNet-filene er en tredjeparts konvertering av Googles modell. Det holder for
måling. Før modellen brukes i produkt skal den byttes med Googles egen
TF.js-utgave eller verifiseres mot den.

SHA-256:

```
59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a  pose_landmarker_lite.task
df8cbde44d00f533ccc4916a7c6ebc17316532fb3fadad114ec667fef22872e9  movenet-lightning.json
bf97bc10d9c8a11200b0190ed64ce039b6252f1aff7cb552aca99b3d191c2f34  movenet-lightning.bin
```
