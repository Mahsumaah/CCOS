"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MeetingType } from "@prisma/client";
import { format } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { I18nFormMessage } from "@/components/forms/i18n-form-message";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { MeetingDetailDTO } from "@/lib/meeting-detail-include";
import { MEETING_TYPES, getMeetingTypeLabel } from "@/lib/meeting-types";
import { editMeetingMetadataSchema } from "@/lib/validations/edit-meeting";
import { cn } from "@/lib/utils";

type EditFormValues = z.infer<typeof editMeetingMetadataSchema>;

function mergeDateAndTime(date: Date, timeHHmm: string): Date {
  const next = new Date(date);
  const [h, m] = timeHHmm.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return next;
  next.setHours(h, m, 0, 0);
  return next;
}

function timeValueFromDate(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function meetingToFormValues(m: MeetingDetailDTO): EditFormValues {
  const at = new Date(m.scheduledAt);
  return {
    title: m.title,
    type: m.type,
    customMeetingType: m.customMeetingType ?? "",
    objectives: m.objectives ?? "",
    scheduledAt: at,
    durationMin: m.durationMin,
    location: m.location ?? "",
  };
}

export function EditMeetingSheet({
  open,
  onOpenChange,
  meeting,
  locale,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: MeetingDetailDTO;
  locale: "ar" | "en";
  onSaved: (m: MeetingDetailDTO) => void;
}) {
  const t = useTranslations("meetings");
  const tCommon = useTranslations("common");
  const dateLocale = locale === "ar" ? arLocale : enUS;

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editMeetingMetadataSchema),
    defaultValues: meetingToFormValues(meeting),
  });

  const meetingType = form.watch("type");
  const showCustomType =
    meetingType === MeetingType.STRATEGIC ||
    meetingType === MeetingType.EMERGENCY;
  const locationVal = form.watch("location") ?? "";
  const isLinkLocation = /^https?:\/\//i.test(locationVal.trim());

  useEffect(() => {
    if (open) {
      form.reset(meetingToFormValues(meeting));
    }
  }, [open, meeting, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...values,
          customMeetingType: showCustomType
            ? values.customMeetingType || null
            : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(body);
        toast.error(tCommon("errorOccurred"));
        return;
      }
      onSaved(body as MeetingDetailDTO);
      toast.success(t("meetingUpdated"));
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error(tCommon("errorOccurred"));
    }
  });

  const sheetSide = locale === "ar" ? "left" : "right";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={sheetSide}
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md rtl:[&>button]:end-auto rtl:[&>button]:start-4 rtl:[&>button]:right-auto"
      >
        <SheetHeader className="border-b p-4 text-start">
          <SheetTitle>{t("editMeetingTitle")}</SheetTitle>
          <SheetDescription>{t("editMeetingDescription")}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={onSubmit}
            className="flex flex-1 flex-col gap-6 overflow-y-auto p-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("meetingTitle")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>{t("formHintMeetingTitle")}</FormDescription>
                  <I18nFormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("meetingType")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MEETING_TYPES.map((mt) => (
                        <SelectItem key={mt} value={mt}>
                          {getMeetingTypeLabel(mt, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <I18nFormMessage />
                </FormItem>
              )}
            />

            {showCustomType ? (
              <FormField
                control={form.control}
                name="customMeetingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("customMeetingTypeLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder={t("customMeetingTypeHint")}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("formHintCustomMeetingType")}
                    </FormDescription>
                    <I18nFormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="objectives"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("objectives")}</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <I18nFormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduledAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("scheduledDateTime")}</FormLabel>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full justify-start ps-3 text-start font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="me-2 size-4" />
                              {field.value
                                ? format(field.value, "PPP", {
                                    locale: dateLocale,
                                  })
                                : t("pickDate")}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(d) => {
                              if (!d) return;
                              const tStr = timeValueFromDate(field.value);
                              field.onChange(mergeDateAndTime(d, tStr));
                            }}
                            locale={dateLocale}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <FormControl>
                      <div className="flex flex-col gap-2">
                        <span className="text-muted-foreground text-sm">
                          {t("scheduledTime")}
                        </span>
                        <Input
                          type="time"
                          value={timeValueFromDate(field.value)}
                          onChange={(e) => {
                            field.onChange(
                              mergeDateAndTime(field.value, e.target.value),
                            );
                          }}
                        />
                      </div>
                    </FormControl>
                  </div>
                  <I18nFormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="durationMin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("duration")}</FormLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    <FormControl>
                      <Input
                        type="number"
                        min={15}
                        max={480}
                        className="w-24"
                        value={Number.isFinite(field.value) ? field.value : 60}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          field.onChange(Number.isFinite(n) ? n : 60);
                        }}
                      />
                    </FormControl>
                    <div className="flex flex-wrap gap-1">
                      {[30, 60, 90, 120].map((m) => (
                        <Button
                          key={m}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => field.onChange(m)}
                        >
                          {m}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <I18nFormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("location")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder={t("placeOrLinkPlaceholder")}
                    />
                  </FormControl>
                  <p className="text-muted-foreground text-xs">
                    {isLinkLocation
                      ? t("locationAsLink")
                      : t("locationAsVenue")}
                  </p>
                  <I18nFormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="mt-auto flex-row gap-2 border-t p-0 pt-4 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Spinner className="size-4" />
                ) : null}
                {tCommon("save")}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
