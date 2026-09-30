import type { RequestHandler } from "express";
import { refreshTokenCookieName } from "../constants/auth.js";
import { authService } from "../services/auth.service.js";
import { passwordService } from "../services/password.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { AppError } from "../utils/app-error.js";
import { clearRefreshTokenCookie, setRefreshTokenCookie } from "../utils/cookies.js";

export class AuthController {
  login: RequestHandler = async (req, res) => {
    const result = await authService.login(req.body);
    setRefreshTokenCookie(res, result.tokens.refreshToken);

    sendSuccess(res, 200, {
      message: "Login successful",
      data: result,
    });
  };

  refresh: RequestHandler = async (req, res) => {
    const refreshTokenFromBody = req.body.refreshToken;
    const refreshTokenFromCookie = req.cookies[refreshTokenCookieName];

    if (!refreshTokenFromBody && refreshTokenFromCookie && req.header("x-csrf-token") !== "refresh-token") {
      throw new AppError("CSRF validation failed", 403);
    }

    const result = await authService.refresh({
      refreshToken: refreshTokenFromBody ?? refreshTokenFromCookie,
    });
    setRefreshTokenCookie(res, result.tokens.refreshToken);

    sendSuccess(res, 200, {
      message: "Token refreshed successfully",
      data: result,
    });
  };

  me: RequestHandler = async (req, res) => {
    const profile = await authService.getProfile(req.user!.id);

    sendSuccess(res, 200, {
      message: "Profile fetched successfully",
      data: profile,
    });
  };

  changePassword: RequestHandler = async (req, res) => {
    const result = await passwordService.changePassword(req.user!.id, req.body, {
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
      deviceId: req.header("x-device-id") ?? undefined,
    });

    sendSuccess(res, 200, {
      message: "Password changed successfully",
      data: result,
    });
  };

  changePin: RequestHandler = async (req, res) => {
    const result = await passwordService.changePin(req.user!.id, req.body, {
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
      deviceId: req.header("x-device-id") ?? undefined,
    });

    sendSuccess(res, 200, {
      message: "PIN saved successfully",
      data: result,
    });
  };

  logout: RequestHandler = async (req, res) => {
    const refreshToken = req.body?.refreshToken ?? req.cookies?.[refreshTokenCookieName];
    await authService.logout(refreshToken);
    clearRefreshTokenCookie(res);

    sendSuccess(res, 200, {
      message: "Logout successful",
    });
  };
}

export const authController = new AuthController();
