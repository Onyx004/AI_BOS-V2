import { Types } from "mongoose";
import { meetingRepository } from "../../repositories/meeting.repository.js";
import type { ProviderDefinition } from "../types.js";

type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  status?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export const googleProvider: ProviderDefinition = {
  family: "google",
  authType: "oauth2",
  oauth: {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopesByIntegration: {
      google_calendar: ["https://www.googleapis.com/auth/calendar.readonly"],
      google_drive: ["https://www.googleapis.com/auth/drive.readonly"],
      gmail: ["https://www.googleapis.com/auth/gmail.readonly"],
    },
  },
  integrations: [
    { key: "google_calendar", name: "Google Calendar", description: "Sync events and meetings from Google Calendar.", category: "Calendar & Email" },
    { key: "google_drive", name: "Google Drive", description: "Access and sync files from Google Drive.", category: "File Storage" },
    { key: "gmail", name: "Gmail", description: "Read and sync email from Gmail.", category: "Calendar & Email" },
  ],
  async testConnection(accessToken) {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return { ok: false, detail: `Google API responded with ${response.status}` };
    }
    const body = (await response.json()) as { email?: string };
    return { ok: true, detail: body.email ? `Connected as ${body.email}` : "Connected" };
  },
  async sync(accessToken, integrationKey, context) {
    if (integrationKey === "google_calendar") {
      const timeMin = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("timeMin", timeMin);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return { itemsSynced: 0, summary: `Calendar sync failed (${response.status})` };
      const body = (await response.json()) as { items?: GoogleCalendarEvent[] };
      const events = body.items ?? [];
      const organizationId = new Types.ObjectId(context.organizationId);

      let synced = 0;
      for (const event of events) {
        const startTime = event.start?.dateTime ?? event.start?.date;
        if (!event.id || !event.summary || !startTime) continue;
        await meetingRepository.upsertSynced(organizationId, "google", event.id, {
          title: event.summary,
          startTime: new Date(startTime),
          endTime: event.end?.dateTime || event.end?.date ? new Date(event.end.dateTime ?? event.end.date!) : undefined,
          status: event.status === "cancelled" ? "Cancelled" : "Scheduled",
          link: event.hangoutLink ?? event.htmlLink,
          organizerName: "Google Calendar",
        });
        synced += 1;
      }

      return { itemsSynced: synced, summary: `${synced} calendar events synced` };
    }

    if (integrationKey === "google_drive") {
      const response = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=5", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return { itemsSynced: 0, summary: `Drive sync failed (${response.status})` };
      const body = (await response.json()) as { files?: unknown[] };
      return { itemsSynced: body.files?.length ?? 0, summary: `${body.files?.length ?? 0} recent files` };
    }

    // gmail
    const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/labels", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return { itemsSynced: 0, summary: `Gmail sync failed (${response.status})` };
    const body = (await response.json()) as { labels?: unknown[] };
    return { itemsSynced: body.labels?.length ?? 0, summary: `${body.labels?.length ?? 0} labels visible` };
  },
};
