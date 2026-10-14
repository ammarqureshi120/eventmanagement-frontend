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
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedApi };
export type GetMeApiResponse = /** status 200 OK */ MeResponse;
export type GetMeApiArg = void;
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
};
export const { useGetMeQuery, useLazyGetMeQuery } = injectedRtkApi;
