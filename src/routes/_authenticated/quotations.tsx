import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";
export const Route = createFileRoute("/_authenticated/quotations")({
  component: () => <StubPage title="Quotations" body="Generate, send and convert branded quotes." />,
});