"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { BoardRole } from "@prisma/client";
import { MeetingSchedulingMode, MeetingType } from "@prisma/client";
import { format } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/lib/permissions-context";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DashboardBreadcrumbs } from "@/components/layout/dashboard-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  I18nFormMessage,
  translateMeetingsFormError,
} from "@/components/forms/i18n-form-message";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getRoleLabel } from "@/lib/board-roles";
import { MEETING_TYPES, getMeetingTypeLabel } from "@/lib/meeting-types";
import { usePlanUpgrade } from "@/components/plan/plan-upgrade-provider";
import { Link, useRouter } from "@/lib/i18n/routing";
import type { PlanLimitApiBody } from "@/lib/plan-limits-config";
import { cn } from "@/lib/utils";
import {
  meetingFormSchema,
  type MeetingFormValues,
} from "@/lib/validations/create-meeting";

type BoardUserOption = {
  id: string;
  name: string;
  email: string;
  role: BoardRole;
};

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

export function CreateMeetingForm() {
  const t = useTranslations("meetings");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const { showPlanUpgradeFromApiBody } = usePlanUpgrade();
  const { status } = useSession();
  const perms = usePermissions();
  const dateLocale = locale === "ar" ? arLocale : enUS;

  const [users, setUsers] = useState<BoardUserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [guestDraft, setGuestDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<MeetingFormValues>({
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      type: MeetingType.BOARD,
      customMeetingType: "",
      objectives: "",
      schedulingMode: MeetingSchedulingMode.SCHEDULED,
      scheduledAt: new Date(),
      durationMin: 60,
      location: "",
      agenda: [{ titleAr: "", titleEn: "", notes: "" }],
      inviteeIds: [],
      guestEmails: [],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "agenda",
  });

  const schedulingMode = form.watch("schedulingMode");
  const meetingType = form.watch("type");
  const locationVal = form.watch("location") ?? "";

  const isLinkLocation = useMemo(
    () => /^https?:\/\//i.test(locationVal.trim()),
    [locationVal],
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!perms.canCreateMeetings) {
      router.replace("/meetings");
    }
  }, [perms.canCreateMeetings, status, router]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users?picker=1", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: BoardUserOption[]) => {
        if (!cancelled) setUsers(data);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          toast.error(tCommon("errorOccurred"));
        }
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tCommon]);

  useEffect(() => {
    if (schedulingMode === MeetingSchedulingMode.INSTANT) {
      // Avoid validating the whole form here — zodResolver would run against
      // default empty agenda rows and throw before the user fills them.
      form.setValue("scheduledAt", new Date(), { shouldValidate: false });
    }
  }, [schedulingMode, form]);

  const inviteeIds = form.watch("inviteeIds");
  const guestEmails = form.watch("guestEmails") ?? [];

  const toggleInvitee = (id: string) => {
    const cur = form.getValues("inviteeIds");
    if (cur.includes(id)) {
      form.setValue(
        "inviteeIds",
        cur.filter((x) => x !== id),
        { shouldValidate: false },
      );
    } else {
      form.setValue("inviteeIds", [...cur, id], { shouldValidate: false });
    }
  };

  const addGuestEmail = () => {
    const e = guestDraft.trim();
    if (!e) return;
    const ok = z.string().email().safeParse(e).success;
    if (!ok) {
      toast.error(t("invalidGuestEmail"));
      return;
    }
    const cur = form.getValues("guestEmails") ?? [];
    if (cur.some((x) => x.toLowerCase() === e.toLowerCase())) {
      setGuestDraft("");
      return;
    }
    form.setValue("guestEmails", [...cur, e], { shouldValidate: false });
    setGuestDraft("");
  };

  const onSubmit = async (values: MeetingFormValues) => {
    setSubmitting(true);
    try {
      const agenda = values.agenda
        .map((a) => ({
          titleAr: a.titleAr.trim(),
          titleEn: a.titleEn?.trim() || undefined,
          notes: a.notes?.trim() || undefined,
        }))
        .filter((a) => a.titleAr.length > 0);

      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...values,
          agenda,
          scheduledAt: values.scheduledAt.toISOString(),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as PlanLimitApiBody &
        Record<string, unknown>;
      if (!res.ok) {
        if (res.status === 403 && payload.upgradeRequired) {
          showPlanUpgradeFromApiBody(payload, locale);
          return;
        }
        console.error(payload);
        toast.error(tCommon("errorOccurred"));
        return;
      }
      toast.success(t("createSuccess"));
      router.push("/meetings");
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(tCommon("errorOccurred"));
    } finally {
      setSubmitting(false);
    }
  };

  const showCustomType =
    meetingType === MeetingType.STRATEGIC ||
    meetingType === MeetingType.EMERGENCY;

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 py-8">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  if (!perms.canCreateMeetings) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-10">
      <DashboardBreadcrumbs
        items={[
          { href: "/dashboard", label: tNav("dashboard") },
          { href: "/meetings", label: tNav("meetings") },
          { label: t("createTitle") },
        ]}
      />
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit gap-2 ps-0" asChild>
          <Link href="/meetings">
            <ArrowLeft className="size-4" />
            {t("backToList")}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{t("createTitle")}</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                    <Input {...field} placeholder={t("customMeetingTypeHint")} />
                  </FormControl>
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
                  <Textarea rows={4} {...field} />
                </FormControl>
                <I18nFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="schedulingMode"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>{t("schedulingMode")}</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex flex-col gap-2 sm:flex-row sm:gap-6"
                  >
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <RadioGroupItem value={MeetingSchedulingMode.SCHEDULED} />
                      </FormControl>
                      <FormLabel className="font-normal">
                        {t("schedulingScheduled")}
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <RadioGroupItem value={MeetingSchedulingMode.INSTANT} />
                      </FormControl>
                      <FormLabel className="font-normal">
                        {t("schedulingInstant")}
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <I18nFormMessage />
              </FormItem>
            )}
          />

          {schedulingMode === MeetingSchedulingMode.SCHEDULED ? (
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
          ) : (
            <p className="text-muted-foreground text-sm">{t("instantScheduleHint")}</p>
          )}

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
                        variant={field.value === m ? "default" : "outline"}
                        className={
                          field.value === m
                            ? "bg-primary text-primary-foreground"
                            : ""
                        }
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
                  <Input {...field} placeholder={t("placeOrLinkPlaceholder")} />
                </FormControl>
                {field.value?.trim() ? (
                  <p className="text-muted-foreground text-xs">
                    {isLinkLocation ? t("locationAsLink") : t("locationAsVenue")}
                  </p>
                ) : null}
                <I18nFormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <FormLabel>{t("agenda")}</FormLabel>
                <p className="text-muted-foreground text-xs font-normal leading-snug">
                  {t("formHintAgenda")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => append({ titleAr: "", titleEn: "", notes: "" })}
              >
                <Plus className="size-4" />
                {t("addAgendaItem")}
              </Button>
            </div>
            {fields.map((item, index) => (
              <Card key={item.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-base font-medium">
                    {t("agendaItemNumber", { n: index + 1 })}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label={t("moveUp")}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label={t("moveDown")}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive size-8"
                      disabled={fields.length <= 1}
                      onClick={() => remove(index)}
                      aria-label={t("removeItem")}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <FormField
                    control={form.control}
                    name={`agenda.${index}.titleAr`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("agendaTitleAr")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <I18nFormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`agenda.${index}.titleEn`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("agendaTitleEn")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <I18nFormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`agenda.${index}.notes`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("agendaNotes")}</FormLabel>
                        <FormControl>
                          <Textarea rows={2} {...field} />
                        </FormControl>
                        <I18nFormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            ))}
            {form.formState.errors.agenda?.message ? (
              <p className="text-destructive text-sm">
                {translateMeetingsFormError(
                  String(form.formState.errors.agenda.message),
                  t,
                )}
              </p>
            ) : null}
          </div>

          <FormField
            control={form.control}
            name="inviteeIds"
            render={() => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel>{t("invitees")}</FormLabel>
                <p className="text-muted-foreground text-xs leading-snug">
                  {t("formHintInvitees")}
                </p>
                <Popover open={inviteOpen} onOpenChange={setInviteOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full max-w-md justify-between font-normal"
                      disabled={usersLoading}
                    >
                      {t("inviteesSearch")}
                      <ChevronDown className="ms-2 size-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t("inviteesSearch")} />
                      <CommandList>
                        <CommandEmpty>{t("noUsersFound")}</CommandEmpty>
                        <CommandGroup>
                          {users.map((u) => {
                            const selected = inviteeIds.includes(u.id);
                            return (
                              <CommandItem
                                key={u.id}
                                value={`${u.name} ${u.email}`}
                                onSelect={() => toggleInvitee(u.id)}
                              >
                                <Check
                                  className={cn(
                                    "me-2 size-4",
                                    selected ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <span className="truncate">
                                  {u.name} — {getRoleLabel(u.role, locale)}
                                </span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <div className="flex flex-wrap gap-2">
                  {inviteeIds.map((id) => {
                    const u = users.find((x) => x.id === id);
                    if (!u) return null;
                    return (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="gap-1 py-1 ps-2 pe-1"
                      >
                        <span className="max-w-[200px] truncate">{u.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ({getRoleLabel(u.role, locale)})
                        </span>
                        <button
                          type="button"
                          className="hover:bg-muted rounded p-0.5"
                          onClick={() => toggleInvitee(id)}
                          aria-label={t("removeItem")}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
                <I18nFormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <FormLabel>{t("guestEmails")}</FormLabel>
            <div className="flex max-w-md gap-2">
              <Input
                type="email"
                value={guestDraft}
                onChange={(e) => setGuestDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addGuestEmail();
                  }
                }}
                placeholder={t("guestEmailPlaceholder")}
              />
              <Button type="button" variant="secondary" onClick={addGuestEmail}>
                {t("addGuest")}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">{t("guestEmailsHint")}</p>
            <div className="flex flex-wrap gap-2">
              {guestEmails.map((email) => (
                <Badge
                  key={email}
                  variant="outline"
                  className="gap-1 py-1 ps-2 pe-1"
                >
                  {email}
                  <button
                    type="button"
                    className="hover:bg-muted rounded p-0.5"
                    onClick={() =>
                      form.setValue(
                        "guestEmails",
                        guestEmails.filter((g) => g !== email),
                        { shouldValidate: false },
                      )
                    }
                    aria-label={t("removeItem")}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            className="bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="me-2 size-4 animate-spin" />
                {t("submitCreating")}
              </>
            ) : (
              t("submitCreate")
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
