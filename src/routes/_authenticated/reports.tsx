import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";
export const Route = createFileRoute("/_authenticated/reports")({
  component: () => <StubPage title="Reports & analytics" body="Revenue, branch and staff performance, insurer portfolio and more." />,
});