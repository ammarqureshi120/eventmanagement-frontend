import { describe, expect, it } from "vitest"

import { initialsOf, fullNameOf } from "./use-me"
import { navItemsFor, roleHome, roleLabel, ROLE_LABEL } from "./roles"

describe("roles", () => {
  it("sends a System Administrator home to /platform", () => {
    expect(roleHome("systemAdministrator")).toBe("/platform")
  })

  it.each(["orgAdministrator", "eventManager", "somethingNew"])(
    "has no home route yet for %s (callers fall back to /, which shows No access)",
    (role) => {
      expect(roleHome(role)).toBeNull()
    },
  )

  it("labels roles in plain words with a neutral fallback", () => {
    expect(ROLE_LABEL.systemAdministrator).toBe("System Administrator")
    expect(roleLabel("orgAdministrator")).toBe("Org Administrator")
    expect(roleLabel("eventManager")).toBe("Event Manager")
    expect(roleLabel("somethingNew")).toBe("Team member")
  })

  it("maps nav areas to items; account renders nothing until My account exists", () => {
    expect(navItemsFor(["platform", "account"]).map((item) => [item.label, item.to])).toEqual([
      ["Platform overview", "/platform"],
    ])
    expect(navItemsFor(["account"])).toEqual([])
  })

  it("builds initials and the full name, falling back to the email", () => {
    expect(initialsOf({ firstName: "Sara", lastName: "Admin", email: "s@x.test" })).toBe("SA")
    expect(initialsOf({ firstName: " ", lastName: "", email: "sara@x.test" })).toBe("S")
    expect(fullNameOf({ firstName: "Sara", lastName: "Admin", email: "s@x.test" })).toBe("Sara Admin")
    expect(fullNameOf({ firstName: "", lastName: "", email: "s@x.test" })).toBe("s@x.test")
  })
})
