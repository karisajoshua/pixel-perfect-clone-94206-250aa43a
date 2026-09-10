import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { requireRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  getWhatsAppOverview, saveWhatsAppChannel, testWhatsAppConnection,
  saveWhatsAppTemplate, cloneWhatsAppTemplate, setWhatsAppTemplateStatus, deleteWhatsAppTemplate,
  sendWhatsAppTest, setWhatsAppConsent,
} from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/admin/whatsapp")({
  beforeLoad: requireRole(["admin", "manager"]),
  head: () => ({
    meta: [
      { title: "WhatsApp messaging — Admin" },
      { name: "description", content: "Connect your WhatsApp business number, manage message templates, consent and test sends." },
      { property: "og:title", content: "WhatsApp messaging — Admin" },
      { property: "og:description", content: "Connect your WhatsApp business number, manage message templates, consent and test sends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsAppAdmin;
});

function WhatsAppAdmin() {
  return null;
}
