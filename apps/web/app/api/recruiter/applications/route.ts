import { createApplicationsRouteHandlers } from "@/lib/server/applications-route";

const handlers = createApplicationsRouteHandlers();

export const GET = handlers.GET_RECRUITER;
