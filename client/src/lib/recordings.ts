// SIM XR — /api/recordings.json fetch + types.
//
// Server-side spec: Sim XR/03_ops_setup/cowork_brief_recordings_page_2026-05-06.md
// Endpoint: GET https://api.simxr.app/api/recordings.json (CORS *).
// Returned newest-first by recorded_at. Empty case is `{ recordings: [], ts }`.
//
// The `Recording` type is intentionally permissive — server may add sidecar
// fields (num_demos, duration_seconds, success, …) over time without us
// rebuilding. Keep extra-key pass-through.

import { isMockMode } from "./scenes";

export interface Recording {
  /** "<task_id>/<basename>" — globally unique key for React lists. */
  id: string;
  /** Gym task id, e.g. "Isaac-PickPlace-Locomanipulation-G1-3DGS-BrightLivingRoom-Abs-v0". */
  task_id: string;
  /** "demo_2026-05-06_19-30-12.hdf5". */
  file_name: string;
  /** Bytes — used for size pill. */
  file_size_bytes: number;
  /** ISO 8601 UTC, second precision. */
  recorded_at: string;
  /**
   * Server-declared download URL. Apache currently DOES NOT serve this — the
   * field is documented for forward-compat. If a Download button is wired
   * before the apache alias ships, the request will 404. Treat as advisory
   * for now; CC will flip apache to serve `/api/recordings/...` when we ask.
   */
  download_path?: string;

  // Optional sidecar fields (may or may not be set by the server).
  num_demos?: number;
  duration_seconds?: number;
  success?: boolean;

  // Forward-compat passthrough — any additional sidecar fields surface here.
  [key: string]: unknown;
}

export interface RecordingsResponse {
  recordings: Recording[];
  /** Server-side generation time, ISO 8601 UTC. */
  ts: string;
}

const API_BASE = "https://api.simxr.app/api";

export class RecordingsFetchError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RecordingsFetchError";
  }
}

export async function fetchRecordings(): Promise<RecordingsResponse> {
  if (isMockMode()) {
    return buildMockRecordingsResponse();
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/recordings.json`, { cache: "no-store" });
  } catch (e) {
    throw new RecordingsFetchError("Failed to reach /api/recordings.json", e);
  }
  if (!response.ok) {
    throw new RecordingsFetchError(
      `/api/recordings.json returned HTTP ${response.status}`,
    );
  }
  return response.json() as Promise<RecordingsResponse>;
}

/**
 * `?fresh=<task_id>` highlight rule — show "Just recorded" badge if this
 * recording's task_id matches the query param AND it was recorded within
 * the last 60 seconds (cutoff per the brief). Tolerant to clock skew between
 * client and server: a small negative delta (server clock slightly ahead)
 * still counts as fresh.
 */
export function shouldHighlightFresh(
  rec: Recording,
  fresh: string | null,
): boolean {
  if (!fresh || rec.task_id !== fresh) return false;
  const dt = Date.now() - new Date(rec.recorded_at).getTime();
  // Allow up to 5s of "future" timestamp tolerance + 60s freshness window.
  return dt >= -5_000 && dt <= 60_000;
}

// ─── Mock mode ──────────────────────────────────────────────────────────
// ?mock=1 renders /recordings without the server. ?mock=1&fresh=<task_id>
// is honored by the page itself — the mock just provides a recent entry
// for that task so the badge demo works.

function buildMockRecordingsResponse(): RecordingsResponse {
  const now = Date.now();
  const min = 60_000;
  const recordings: Recording[] = [
    {
      id: "Isaac-PickPlace-Locomanipulation-G1-3DGS-BrightLivingRoom-Abs-v0/demo_2026-05-06_19-30-12",
      task_id: "Isaac-PickPlace-Locomanipulation-G1-3DGS-BrightLivingRoom-Abs-v0",
      file_name: "demo_2026-05-06_19-30-12.hdf5",
      file_size_bytes: 12_345_678,
      recorded_at: new Date(now - 25 * 1000).toISOString(),
      download_path:
        "/api/recordings/Isaac-PickPlace-Locomanipulation-G1-3DGS-BrightLivingRoom-Abs-v0/demo_2026-05-06_19-30-12.hdf5",
      num_demos: 1,
      duration_seconds: 142,
    },
    {
      id: "Isaac-NutPour-GR1T2-Pink-IK-Abs-v0/demo_2026-05-06_18-15-04",
      task_id: "Isaac-NutPour-GR1T2-Pink-IK-Abs-v0",
      file_name: "demo_2026-05-06_18-15-04.hdf5",
      file_size_bytes: 8_754_321,
      recorded_at: new Date(now - 70 * min).toISOString(),
      num_demos: 3,
      duration_seconds: 287,
    },
    {
      id: "Isaac-PickPlace-Locomanipulation-G1-Abs-v0/demo_2026-05-05_22-04-18",
      task_id: "Isaac-PickPlace-Locomanipulation-G1-Abs-v0",
      file_name: "demo_2026-05-05_22-04-18.hdf5",
      file_size_bytes: 14_002_001,
      recorded_at: new Date(now - 24 * 60 * min).toISOString(),
      num_demos: 5,
      duration_seconds: 612,
    },
  ];
  return { recordings, ts: new Date(now).toISOString() };
}
