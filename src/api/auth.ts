import { request } from "./client";

type ApiSuccess = {
  success: true;
};

export type User = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: string | null;
  classroomAccess: boolean;
  avatarUrl: string | null;
  age: number | null;
  lastVerifiedAt: string | null;
  lastLoginAt: string | null;
  lastPasswordResetAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  hasPassword: boolean;
};

export type AuthResponse = ApiSuccess & {
  token: string;
  user: User;
};

export type ProfileResponse = ApiSuccess & {
  user: User;
};

export const register = (phone: string, password: string, name?: string) =>
  request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: { phone, password, name },
  });

export const login = (phone: string, password: string) =>
  request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { phone, password },
  });

export const profile = (token: string) =>
  request<ProfileResponse>("/api/auth/profile", {
    method: "GET",
    token,
  });
