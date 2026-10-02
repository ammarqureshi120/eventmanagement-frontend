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
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedApi };
export type GetAntiforgeryTokenApiResponse = unknown;
export type GetAntiforgeryTokenApiArg = void;
export const { useGetAntiforgeryTokenQuery, useLazyGetAntiforgeryTokenQuery } =
  injectedRtkApi;
