/** Who is signed in and where they may go (AD-9). Server state only; nothing here is stored in a slice. */
export { useMe, initialsOf, fullNameOf, type MeStatus, type UseMeResult } from "./use-me"
export { safeReturnTo, loginPathFor } from "./return-to"
export { ROLE_LABEL, roleLabel, roleHome, NAV_ITEMS, navItemsFor, type NavItem } from "./roles"
