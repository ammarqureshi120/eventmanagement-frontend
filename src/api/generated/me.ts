import { baseApi as api } from "../../shared/api/base-api";
export const addTagTypes = ["Me"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getMe: build.query<GetMeApiResponse, GetMeApiArg>({
        query: () => ({ url: `/api/me` }),
        providesTags: ["Me"],
      }),
      updateMyProfile: build.mutation<
        UpdateMyProfileApiResponse,
        UpdateMyProfileApiArg
      >({
        query: (queryArg) => ({
          url: `/api/me/profile`,
          method: "PUT",
          body: queryArg.updateMyProfileRequest,
        }),
        invalidatesTags: ["Me"],
      }),
      changeMyPassword: build.mutation<
        ChangeMyPasswordApiResponse,
        ChangeMyPasswordApiArg
      >({
        query: (queryArg) => ({
          url: `/api/me/change-password`,
          method: "POST",
          body: queryArg.changeMyPasswordRequest,
        }),
        invalidatesTags: ["Me"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedApi };
export type GetMeApiResponse = /** status 200 OK */ MeResponse;
export type GetMeApiArg = void;
export type UpdateMyProfileApiResponse = unknown;
export type UpdateMyProfileApiArg = {
  updateMyProfileRequest: UpdateMyProfileRequest;
};
export type ChangeMyPasswordApiResponse = unknown;
export type ChangeMyPasswordApiArg = {
  changeMyPasswordRequest: ChangeMyPasswordRequest;
};
export type UserRole =
  "systemAdministrator" | "orgAdministrator" | "eventManager";
export type MeOrganization = {
  id: string;
  name: string;
};
export type NavArea = "platform" | "account";
export type MeResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  organization: (null | null) | MeOrganization;
  version: number;
  navAreas: NavArea[];
  sessionExpiresAt: string;
};
export type UpdateMyProfileRequest = {
  firstName: string;
  lastName: string;
  phone: string | null;
  version: number | null;
};
export type ChangeMyPasswordRequest = {
  currentPassword: string;
  newPassword: string;
};
export const {
  useGetMeQuery,
  useLazyGetMeQuery,
  useUpdateMyProfileMutation,
  useChangeMyPasswordMutation,
} = injectedRtkApi;
