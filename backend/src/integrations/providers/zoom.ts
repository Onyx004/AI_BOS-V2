import { Types } from "mongoose";
import { meetingRepository } from "../../repositories/meeting.repository.js";
import type { ProviderDefinition } from "../types.js";

type ZoomMeeting = {
  id: number | string;
  topic?: string;
  start_time?: string;
  duration?: number;
  join_url?: string;
  status?: string;
};

export const zoomProvider: ProviderDefinition = {
  family: "zoom",
  authType: "oauth2",
  oauth: {
    authorizationUrl: "https://zoom.us/oauth/authorize",
    tokenUrl: "https://zoom.us/oauth/token",
    scopesByIntegration: {
      zoom: ["meeting:read"],
    },
  },
  integrations: [
    { key: "zoom", name: "Zoom", description: "Sync meetings and recordings from Zoom.", category: "Communication" },
  ],
  async testConnection(accessToken) {
    const response = await fetch("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return { ok: false, detail: `Zoom API responded with ${response.status}` };
    }
    const body = (await response.json().catch(() => ({}))) as { email?: string };
    return { ok: true, detail: body.email ? `Connected as ${body.email}` : "Connected" };
  },
  async sync(accessToken, _integrationKey, context) {
    const response = await fetch("https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=50", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return { itemsSynced: 0, summary: `Zoom sync failed (${response.status})` };

    const body = (await response.json().catch(() => ({}))) as { meetings?: ZoomMeeting[] };
    const meetings = body.meetings ?? [];
    const organizationId = new Types.ObjectId(context.organizationId);

    let synced = 0;
    for (const meeting of meetings) {
      if (!meeting.id || !meeting.topic || !meeting.start_time) continue;
      const startTime = new Date(meeting.start_time);
      const endTime = meeting.duration ? new Date(startTime.getTime() + meeting.duration * 60_000) : undefined;
      await meetingRepository.upsertSynced(organizationId, "zoom", String(meeting.id), {
        title: meeting.topic,
        startTime,
        endTime,
        status: "Scheduled",
        link: meeting.join_url,
        organizerName: "Zoom",
      });
      synced += 1;
    }

    return { itemsSynced: synced, summary: `${synced} Zoom meetings synced` };
  },
};
