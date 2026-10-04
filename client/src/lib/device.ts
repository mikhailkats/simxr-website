// SIM XR — which headset is this? (operator MVP, 2026-10-04)
//
// The stream is AV1 (server-side encode budget on the L40S: 7 ms AV1 vs
// 19 ms H.265, measured 2026-05-16). AV1 hardware decode exists on Quest 3 /
// 3S (XR2 Gen 2) and Pico 4 Ultra, NOT on Quest 2 / Quest Pro / Pico 4 —
// those connect, hold the server's only slot and show black. So they are
// stopped before Connect, with a plain explanation.
//
// Quest Browser puts the model in its user agent ("...; Quest 3) ...
// OculusBrowser/..."), Pico's browser carries "PICO 4 Ultra"/"Pico".

export interface DeviceInfo {
  label: string;
  /** true = can stream; false = known not to work; null = not tested (allowed). */
  supported: boolean | null;
  /** Shown under the Connect buttons when supported !== true. */
  note?: string;
  isHeadset: boolean;
}

const NO_AV1 =
  "can't decode the AV1 video this demo streams. Please join from a Meta Quest 3 or Quest 3S.";

export function detectDevice(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): DeviceInfo {
  if (/Quest 3S/i.test(ua)) return { label: "Quest 3S", supported: true, isHeadset: true };
  if (/Quest 3/i.test(ua)) return { label: "Quest 3", supported: true, isHeadset: true };
  if (/Quest 2/i.test(ua)) return { label: "Quest 2", supported: false, isHeadset: true, note: `Quest 2 ${NO_AV1}` };
  if (/Quest Pro/i.test(ua)) return { label: "Quest Pro", supported: false, isHeadset: true, note: `Quest Pro ${NO_AV1}` };
  if (/PICO 4 Ultra/i.test(ua)) return { label: "Pico 4 Ultra", supported: null, isHeadset: true, note: "Pico 4 Ultra is not tested yet — it may work." };
  if (/Pico/i.test(ua)) return { label: "Pico", supported: false, isHeadset: true, note: `This Pico headset ${NO_AV1}` };
  if (/OculusBrowser/i.test(ua)) return { label: "Meta Quest", supported: true, isHeadset: true };
  if (/Android|iPhone|iPad|Mobile/i.test(ua)) {
    return { label: "Phone / tablet", supported: false, isHeadset: false, note: "Open simxr.app in the browser of a Meta Quest 3 or 3S to join." };
  }
  return { label: "Desktop browser", supported: false, isHeadset: false, note: "Open simxr.app in the browser of a Meta Quest 3 or 3S to join." };
}
