import { baseApi as api } from "../../shared/api/base-api";
export const addTagTypes = ["Auth"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getAntiforgeryToken: build.query<
        GetAntiforgeryTokenApiResponse,
        GetAntiforgeryTokenApiArg
      >({
        query: () => ({ url: `/api/auth/antiforgery` }),
        providesTags: ["Auth"],
      }),
      login: build.mutation<LoginApiResponse, LoginApiArg>({
        query: (queryArg) => ({
          url: `/api/auth/login`,
          method: "POST",
          body: queryArg.loginRequest,
        }),
        invalidatesTags: ["Auth"],
      }),
      logout: build.mutation<LogoutApiResponse, LogoutApiArg>({
        query: () => ({ url: `/api/auth/logout`, method: "POST" }),
        invalidatesTags: ["Auth"],
      }),
      forgotPassword: build.mutation<
        ForgotPasswordApiResponse,
        ForgotPasswordApiArg
      >({
        query: (queryArg) => ({
          url: `/api/auth/forgot-password`,
          method: "POST",
          body: queryArg.forgotPasswordRequest,
        }),
        invalidatesTags: ["Auth"],
      }),
      resetPassword: build.mutation<
        ResetPasswordApiResponse,
        ResetPasswordApiArg
      >({
        query: (queryArg) => ({
          url: `/api/auth/reset-password`,
          method: "POST",
          body: queryArg.resetPasswordRequest,
        }),
        invalidatesTags: ["Auth"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedApi };
export type GetAntiforgeryTokenApiResponse = unknown;
export type GetAntiforgeryTokenApiArg = void;
export type LoginApiResponse = unknown;
export type LoginApiArg = {
  loginRequest: LoginRequest;
};
export type LogoutApiResponse = unknown;
export type LogoutApiArg = void;
export type ForgotPasswordApiResponse = unknown;
export type ForgotPasswordApiArg = {
  forgotPasswordRequest: ForgotPasswordRequest;
};
export type ResetPasswordApiResponse =
  /** status 200 OK */ ResetPasswordResponse;
export type ResetPasswordApiArg = {
  resetPasswordRequest: ResetPasswordRequest;
};
export type LoginRequest = {
  email: string;
  password: string;
};
export type ForgotPasswordRequest = {
  email: string;
};
export type ResetPasswordResponse = {
  email: string;
};
export type ResetPasswordRequest = {
  token: string;
  newPassword: string;
};
export const {
  useGetAntiforgeryTokenQuery,
  useLazyGetAntiforgeryTokenQuery,
  useLoginMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = injectedRtkApi;
