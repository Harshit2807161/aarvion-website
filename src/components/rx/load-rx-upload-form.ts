/**
 * Loads the prescription upload form (and with it the upload client) on first use, so neither is
 * in any page's first-load JS. R7's /account/prescriptions and checkout mount it through this (or
 * `next/dynamic`), never with a static import (rx-api.test.ts checks).
 */
export const loadRxUploadForm = () => import("./rx-upload-form").then((m) => m.RxUploadForm);
