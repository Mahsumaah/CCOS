const MEETING_DETAIL_TABS = [
  "agenda",
  "live",
  "votes",
  "decisions",
  "minutes",
] as const;

export type MeetingDetailTab = (typeof MEETING_DETAIL_TABS)[number];

export function parseMeetingDetailTabParam(
  raw: string | string[] | undefined,
): MeetingDetailTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && MEETING_DETAIL_TABS.includes(v as MeetingDetailTab)) {
    return v as MeetingDetailTab;
  }
  return "agenda";
}
