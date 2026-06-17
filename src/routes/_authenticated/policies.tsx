import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";
export const Route = createFileRoute("/_authenticated/policies")({
  component: () => <StubPage title="Policies" body="Active, expired, cancelled and pending-renewal policies." />,
});