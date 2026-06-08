export interface ApiAuthRequest {
  email: string;
  password: string;
}

export interface ApiRegisterRequest {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  country: string;
}

export interface ApiUserMinimal {
  id: number;
  email: string;
  username: string;
  provider: string;
}

export interface ApiUserProfile {
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  avatar: string | null;
  streak: number | null;
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
}

export interface ApiAuthResponse {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  userResponseDTO: ApiUserMinimal;
}

export interface ApiTokenRefreshRequest {
  refreshToken: string;
}

export interface ApiTokenRefreshResponse {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  userResponseDTO: ApiUserMinimal;
}

export interface ApiLogoutRequest {
  refreshToken: string;
}

export interface ApiTextResponse {
  textId: number;
  isCustom: boolean;
  createdBy: number | null;
  title: string;
  author: string;
  source: string;
  language: string;
  content: string;
  wordCount: number;
  charLength: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTextCreateRequest {
  title: string;
  author: string;
  source: string;
  language?: string;
  content: string;
}

export interface ApiTypingResultRequest {
  textId: number;
  finishedAt: string;
  durationMs: number;
  timeConstraintMs: number | null;
  wpm: number;
  accuracy: number;
  textTitle?: string;
  textContent?: string;
}

export interface ApiTypingResultResponse {
  typingResultId: number;
  userId: number;
  username: string;
  textId: number;
  finishedAt: string;
  durationMs: number;
  timeConstraintMs: number | null;
  wpm: number;
  accuracy: number;
  createdAt: string;
  textTitle?: string;
  textContent?: string;
  wordCount: number;
}

export interface ApiUserStatResponse {
  userStatId: number;
  user: ApiUserMinimal;
  averageSpeed: number;
  bestSpeed: number;
  lastSpeed: number;
  textCompleted: number;
}

export interface ApiUserUpdateRequest {
  firstName: string;
  lastName: string;
  country: string;
  currentPassword: string;
}

export interface ApiUserDeactivateRequest {
  currentPassword: string;
}

export interface ApiWordResponse {
  wordId: number;
  word: string;
  language: string;
  difficulty: string;
}
