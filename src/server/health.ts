export interface HealthResponse {
  status: "ok";
  name: "ReproProof";
  version: string;
}

export const APP_VERSION = "0.1.0";

export function getHealthResponse(): HealthResponse {
  return {
    status: "ok",
    name: "ReproProof",
    version: APP_VERSION,
  };
}
