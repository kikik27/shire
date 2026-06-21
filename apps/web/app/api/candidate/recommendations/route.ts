import { createCandidateRecommendationsRouteHandlers } from "@/lib/server/recommendations-route";

export const runtime = "nodejs";

const handlers = createCandidateRecommendationsRouteHandlers();

export const GET = handlers.GET;
