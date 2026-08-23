import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getExpressionConnections } from "@/lib/english/expressionConnectionsService";

export const expressionConnectionKeys = {
  all: ["expression_connections"] as const,
  detail: (expressionId: string) => ["expression_connections", expressionId] as const,
};

export function useExpressionConnections(expressionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: expressionConnectionKeys.detail(expressionId || ""),
    queryFn: () => getExpressionConnections(expressionId!),
    enabled: enabled && Boolean(expressionId),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useInvalidateExpressionConnections() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: expressionConnectionKeys.all });
}

