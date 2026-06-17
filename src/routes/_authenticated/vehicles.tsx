import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";
export const Route = createFileRoute("/_authenticated/vehicles")({
  component: () => <StubPage title="Vehicles" body="Vehicle registration, ownership history, logbooks and inspections." />,
});