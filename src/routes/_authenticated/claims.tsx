import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";
export const Route = createFileRoute("/_authenticated/claims")({
  component: () => <StubPage title="Claims" body="Register and track claims with abstracts, sketches and statements." />,
});