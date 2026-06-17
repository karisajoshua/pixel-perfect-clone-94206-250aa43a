import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";
export const Route = createFileRoute("/_authenticated/invoices")({
  component: () => <StubPage title="Invoices" body="Billing lifecycle from issue through payment reconciliation." />,
});