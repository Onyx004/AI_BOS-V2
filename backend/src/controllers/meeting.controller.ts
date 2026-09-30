import { meetingService } from "../services/meeting.service.js";
import { jsonController } from "../utils/controller.js";
import type { ListMeetingsQuery } from "../validation/meeting.validation.js";

export class MeetingController {
  list = jsonController(200, "Meetings fetched successfully", ({ req }) =>
    meetingService.list(req.query as unknown as ListMeetingsQuery),
  );

  create = jsonController(201, "Meeting created successfully", ({ req }) =>
    meetingService.create(req.body, req.user?.id),
  );

  getById = jsonController(200, "Meeting fetched successfully", ({ req }) =>
    meetingService.getById(req.params.id),
  );

  update = jsonController(200, "Meeting updated successfully", ({ req }) =>
    meetingService.update(req.params.id, req.body),
  );

  delete = jsonController(200, "Meeting deleted successfully", ({ req }) =>
    meetingService.delete(req.params.id),
  );
}

export const meetingController = new MeetingController();
