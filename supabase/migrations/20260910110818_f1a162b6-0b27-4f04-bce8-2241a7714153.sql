GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_consents TO authenticated;
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT SELECT ON public.messaging_usage TO authenticated;

GRANT ALL ON public.messaging_channels TO service_role;
GRANT ALL ON public.whatsapp_templates TO service_role;
GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.conversation_messages TO service_role;
GRANT ALL ON public.contact_consents TO service_role;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
GRANT ALL ON public.messaging_usage TO service_role;

GRANT EXECUTE ON FUNCTION public.messaging_consume_quota(uuid, text, integer) TO service_role;