"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarCheck, MessageSquare, Scale } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanel } from "@/components/dashboard/chat-panel";
import { RaiseDisputeDialog } from "@/components/dashboard/disputes-ui";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { COMPLAINT_CATEGORIES } from "@/lib/constants";
import type { BookingDetail } from "@/app/dashboard/customer/_lib/types";
import { rid, rname } from "@/app/dashboard/customer/_lib/types";
import { EmptyState, ErrorState, StatusBadge, errText, usePageId } from "@/app/dashboard/customer/_lib/ui";
import { OverviewTab } from "./_components/overview-tab";
import { PhasesTab } from "./_components/phases-tab";
import { PaymentsTab } from "./_components/payments-tab";
import { TimelineTab } from "./_components/timeline-tab";
import { ReviewCard } from "./_components/review-card";

export default function BookingDetailPage() {
  const id = usePageId();
  const { toast } = useToast();
  const { t } = useLocale();
  const router = useRouter();
  const [data, setData] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [disputeOpen, setDisputeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const d = await api<BookingDetail>(`/api/bookings/${id}`);
      setData(d);
    } catch (e) {
      setError(errText(e, t));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted) setTab(wanted);
  }, []);

  const openConversation = async () => {
    if (!data) return;
    try {
      await api("/api/conversations", {
        body: { workerId: rid(data.booking.workerId), bookingId: rid(data.booking._id) },
      });
      await load();
      setTab("messages");
    } catch (e) {
      toast({ title: t("customer.bookingDetail.chatFailed"), description: errText(e, t), variant: "destructive" });
    }
  };

  const conversationId = data?.conversation?._id || rid(data?.booking.conversationId || null);

  return (
    <DashboardShell
      role="customer"
      nav={CUSTOMER_NAV}
      title={t("customer.bookingTitle")}
      subtitle={data ? `${data.booking.code} · ${data.booking.title}` : t("customer.bookingDetail.loading")}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/customer/bookings">
              <ArrowLeft className="mr-2 h-4 w-4" /> {t("customer.allBookings")}
            </Link>
          </Button>
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="h-32 rounded-xl border bg-card" />
            <div className="h-24 rounded-xl border bg-card" />
            <div className="h-72 rounded-xl border bg-card" />
          </div>
        )}

        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && data && (
          <>
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-muted-foreground">{data.booking.code}</span>
                  <StatusBadge status={data.booking.status} />
                  {data.booking.disputeOpen && <StatusBadge status="DISPUTED" />}
                </div>
                <h2 className="mt-1 truncate text-xl font-bold sm:text-2xl">{data.booking.title}</h2>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/workers/${rid(data.booking.workerId)}`}>{t("customer.viewWorker")}</Link>
                </Button>
                <Button size="sm" variant={conversationId ? "default" : "outline"} onClick={openConversation}>
                  <MessageSquare className="mr-2 h-4 w-4" /> {t("customer.messageLabel")}
                </Button>
                {!data.booking.disputeOpen && (
                  <Button size="sm" variant="outline" onClick={() => setDisputeOpen(true)}>
                    <Scale className="mr-2 h-4 w-4" /> {t("common.dispute.raise")}
                  </Button>
                )}
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
                <TabsTrigger value="overview">{t("nav.overview")}</TabsTrigger>
                <TabsTrigger value="phases">{t("customer.bookingDetail.tabPhases")}</TabsTrigger>
                <TabsTrigger value="payments">{t("nav.payments")}</TabsTrigger>
                <TabsTrigger value="timeline">{t("customer.bookingDetail.tabTimeline")}</TabsTrigger>
                <TabsTrigger value="messages">{t("nav.messages")}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-6">
                <OverviewTab data={data} reload={load} />
                <ReviewCard data={data} reload={load} />
              </TabsContent>

              <TabsContent value="phases" className="mt-4">
                <PhasesTab data={data} reload={load} />
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                <PaymentsTab data={data} reload={load} />
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <TimelineTab data={data} />
              </TabsContent>

              <TabsContent value="messages" className="mt-4">
                {conversationId ? (
                  <div className="h-[calc(100vh-19rem)] min-h-[420px]">
                    <ChatPanel conversationId={conversationId} otherName={rname(data.booking.workerId, t("customer.workerLabel"))} />
                  </div>
                ) : (
                  <EmptyState
                    icon={MessageSquare}
                    title={t("customer.bookingDetail.noConversation")}
                    message={t("customer.bookingDetail.noConversationMsg")}
                  >
                    <Button onClick={openConversation}>
                      <MessageSquare className="mr-2 h-4 w-4" /> {t("customer.bookingDetail.startChatting")}
                    </Button>
                  </EmptyState>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        {!loading && !error && !data && (
          <EmptyState
            icon={CalendarCheck}
            title={t("customer.bookingDetail.notFound")}
            message={t("customer.bookingDetail.notFoundMsg")}
          >
            <Button asChild>
              <Link href="/dashboard/customer/bookings">{t("customer.bookingDetail.backToBookings")}</Link>
            </Button>
          </EmptyState>
        )}

        {data && (
          <RaiseDisputeDialog
            open={disputeOpen}
            onOpenChange={setDisputeOpen}
            bookingId={rid(data.booking._id)}
            bookingLabel={data.booking.code}
            categories={[...COMPLAINT_CATEGORIES]}
            onCreated={(disputeId) => router.push(`/dashboard/customer/disputes/${disputeId}`)}
          />
        )}
      </div>
    </DashboardShell>
  );
}
