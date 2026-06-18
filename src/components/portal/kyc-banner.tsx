import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, FileUp, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  status: string;
  missingFields: string[];
  hasUploadedDocs: boolean;
};

export function KycBanner({ status, missingFields, hasUploadedDocs }: Props) {
  if (status === "verified") return null;

  const pendingReview = hasUploadedDocs && missingFields.length === 0 && status !== "rejected";

  return (
    <div
      className={cn(
        "rounded-lg border p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start",
        pendingReview
          ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
          : status === "rejected"
            ? "border-destructive bg-destructive/10"
            : "border-amber-300 bg-amber-50 dark:bg-amber-950/30",
      )}
    >
      <div className="shrink-0">
        {pendingReview ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        ) : (
          <AlertTriangle className={cn("h-6 w-6", status === "rejected" ? "text-destructive" : "text-amber-600")} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm sm:text-base">
          {pendingReview
            ? "Documents received — pending review"
            : status === "rejected"
              ? "Your KYC was rejected — please re-upload"
              : "Complete your KYC to unlock all features"}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {pendingReview
            ? "Our team will verify your details shortly. You'll be notified by email when done."
            : "Upload a copy of your National ID, KRA PIN certificate and a recent utility bill so we can verify your account."}
        </p>
        {missingFields.length > 0 && (
          <p className="text-xs sm:text-sm mt-2">
            <span className="font-medium">Missing on your profile:</span>{" "}
            <span className="text-muted-foreground">{missingFields.join(", ")}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {!pendingReview && (
            <Button asChild size="sm">
              <Link to="/portal/documents">
                <FileUp className="h-4 w-4 mr-1.5" /> Upload documents
              </Link>
            </Button>
          )}
          {missingFields.length > 0 && (
            <Button asChild size="sm" variant="outline">
              <Link to="/portal/profile">
                <UserCog className="h-4 w-4 mr-1.5" /> Complete profile
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}