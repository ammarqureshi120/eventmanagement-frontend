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
export type LoginRequest = {
  email: string;
  password: string;
};
export const {
  useGetAntiforgeryTokenQuery,
  useLazyGetAntiforgeryTokenQuery,
  useLoginMutation,
  useLogoutMutation,
} = injectedRtkApi;
