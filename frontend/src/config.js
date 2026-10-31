// Values come from public/config.js (overwritten at container start-up).
const cfg = window.LISTJJ_CONFIG || {};

export const config = {
  googleClientId: cfg.googleClientId || "",
  microsoftClientId: cfg.microsoftClientId || "",
  microsoftTenantId: cfg.microsoftTenantId || "common",
};
