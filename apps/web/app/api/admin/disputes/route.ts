import { createAdminRouteHandlers } from "@/lib/server/admin-route";

const handlers = createAdminRouteHandlers();

export const GET = handlers.GET_DISPUTES;
export const PATCH = handlers.PATCH_DISPUTE;
