import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

export function ClientCommunications({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const { data: items } = useQuery({
    queryKey: ["client-comms", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_communications").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_communications").insert({
      client_id: clientId, channel: channel as any, subject, body, created_by: u.user?.id,
    });
    if (error) return toast.error(error.message);
    setSubject(""); setBody("");
    qc.invalidateQueries({ queryKey: ["client-comms", clientId] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Log an interaction</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["call","email","sms","whatsapp","in_person","note"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <Textarea placeholder="Details…" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex justify-end"><Button onClick={add} disabled={!body}>Add entry</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent>
          {items?.length === 0 && <p className="text-sm text-muted-foreground">No communications yet.</p>}
          <ul className="space-y-3">
            {items?.map((i) => (
              <li key={i.id} className="border-l-2 border-primary pl-3">
                <div className="text-xs text-muted-foreground">{format(new Date(i.created_at), "PPp")} • {i.channel}</div>
                {i.subject && <div className="font-medium text-sm">{i.subject}</div>}
                {i.body && <div className="text-sm whitespace-pre-wrap">{i.body}</div>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}