import { createRecruiterRecommendationsRouteHandlers } from "@/lib/server/recommendations-route";

export const runtime = "nodejs";

const handlers = createRecruiterRecommendationsRouteHandlers();

export const GET = handlers.GET;
