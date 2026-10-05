"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Scale } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DisputePriorityBadge,
  DisputeStatusBadge,
  DisputeSummaryGrid,
  DisputeThread,
  DisputeTimelineList,
  EvidenceGrid,
  type DisputeDetailResp,
} from "@/components/dashboard/disputes-ui";
import { api } from "@/lib/client";
import { useLocale } from "@/context/locale";
import { ErrorState, RowsSkeleton, errText } from "../../_lib/ui";

export default function CustomerDisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const { t } = useLocale();
  const [data, setData] = useState<DisputeDetailResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setData(await api<DisputeDetailResp>(`/api/disputes/${id}`));
    } catch (e) {
      setError(errText(e, t));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardShell
      role="customer"
      nav={CUSTOMER_NAV}
      title={data?.dispute.code || t("common.dispute.detail")}
      subtitle={data?.dispute.subject}
    >
      <div className="max-w-4xl space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/customer/disputes">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.back")}
          </Link>
        </Button>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading && !data ? (
          <RowsSkeleton n={3} />
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <DisputeStatusBadge status={data.dispute.status} />
              <DisputePriorityBadge priority={data.dispute.priority} />
              <Button
                variant="ghost"
                size="icon"
                onClick={load}
                aria-label={t("common.refresh")}
                className="ml-auto"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Scale className="h-4 w-4" /> {t("common.dispute.detail")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <DisputeSummaryGrid dispute={data.dispute} />

                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("common.dispute.description")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{data.dispute.description}</p>
                </div>

                {data.dispute.evidenceFileIds && data.dispute.evidenceFileIds.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("common.dispute.evidence")}
                    </p>
                    <EvidenceGrid ids={data.dispute.evidenceFileIds} />
                  </div>
                )}

                {data.dispute.resolution && data.dispute.resolution.outcome && (
                  <div className="space-y-1.5 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                      {t("common.dispute.resolution")}
                    </p>
                    <p className="text-sm font-medium">
                      {t(`common.dispute.outcome.${data.dispute.resolution.outcome}`)}
                    </p>
                    {!!data.dispute.resolution.refundAmount && (
                      <p className="text-sm">
                        {t("common.dispute.refundAmount")}:{" "}
                        {data.dispute.resolution.refundAmount} ETB
                      </p>
                    )}
                    {data.dispute.resolution.notes && (
                      <p className="text-sm">{data.dispute.resolution.notes}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("common.dispute.conversation")}</CardTitle>
              </CardHeader>
              <CardContent>
                <DisputeThread
                  disputeId={data.dispute._id}
                  initialMessages={data.messages}
                  viewerId={data.viewer.id}
                  viewerRole={data.viewer.role}
                  locked={data.dispute.status === "closed"}
                  onSent={load}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("common.dispute.timeline")}</CardTitle>
              </CardHeader>
              <CardContent>
                <DisputeTimelineList entries={data.dispute.timeline || []} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
