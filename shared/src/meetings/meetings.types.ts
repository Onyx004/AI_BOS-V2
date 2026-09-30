export type MeetingStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled";
export type MeetingSource = "manual" | "google" | "zoom";

export type Meeting = {
 id: string;
 title: string;
 organizerName: string;
 startTime: string;
 endTime?: string;
 status: MeetingStatus;
 link?: string;
 source: MeetingSource;
};

export type MeetingFormInput = {
 title: string;
 startTime: string;
 endTime?: string;
 status: MeetingStatus;
 link?: string;
};
