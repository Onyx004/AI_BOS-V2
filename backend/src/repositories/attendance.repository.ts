import type { UpdateQuery } from "mongoose";
import { AttendanceModel, type Attendance, type AttendanceDocument } from "../models/attendance.model.js";

export type AttendanceCreateData = Omit<Attendance, "createdAt" | "updatedAt">;

export class AttendanceRepository {
  async create(data: AttendanceCreateData) {
    return AttendanceModel.create(data);
  }

  async findByUserAndDate(userId: string, date: string) {
    return AttendanceModel.findOne({ userId, date }).select("-checkInFaceImage -checkOutFaceImage").lean();
  }

  async findRecentByUser(userId: string, limit: number) {
    return AttendanceModel.find({ userId }).select("-checkInFaceImage -checkOutFaceImage").sort({ date: -1, checkInAt: -1 }).limit(limit).lean();
  }

  async findByDate(date: string) {
    return AttendanceModel.find({ date }).select("-checkInFaceImage -checkOutFaceImage").sort({ checkInAt: -1 }).lean();
  }

  async findAdminOverview(date: string) {
    return AttendanceModel.find({ date })
      .select("-checkInFaceImage -checkOutFaceImage")
      .populate("userId", "fullName email role employeeProfile.employeeCode")
      .sort({ checkInAt: -1 })
      .limit(2000)
      .lean();
  }

  async findOpen() {
    return AttendanceModel.find({ status: "Present", checkOutAt: { $exists: false } })
      .select("userId date checkInAt")
      .lean();
  }

  async closeOpenRecord(id: string, checkOutAt: Date) {
    return AttendanceModel.updateOne(
      { _id: id, checkOutAt: { $exists: false } },
      { $set: { status: "Checked Out", checkOutAt, checkOutMethod: "auto_offline" } },
    );
  }

  async reopenAutoClosed(userId: string, date: string) {
    return AttendanceModel.updateOne(
      { userId, date, checkOutMethod: "auto_offline" },
      { $set: { status: "Present" }, $unset: { checkOutAt: "", checkOutMethod: "" } },
    );
  }

  async updateByUserAndDate(userId: string, date: string, updates: UpdateQuery<AttendanceDocument>) {
    return AttendanceModel.findOneAndUpdate({ userId, date }, updates, {
      new: true,
      runValidators: true,
    }).select("-checkInFaceImage -checkOutFaceImage").lean();
  }
}

export const attendanceRepository = new AttendanceRepository();
