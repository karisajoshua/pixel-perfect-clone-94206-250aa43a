import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";
export const Route = createFileRoute("/_authenticated/renewals")({
  component: () => <StubPage title="Renewals" body="Configure reminder schedules across Email, SMS and WhatsApp." />,
});