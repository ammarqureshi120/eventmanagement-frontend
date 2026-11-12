import { describe, expect, it } from "vitest"

import { PASSWORD_MESSAGES, PASSWORD_RULES, passwordLength, passwordProblems } from "./password-policy"

const met = (password: string) => PASSWORD_RULES.filter((rule) => rule.test(password)).map((rule) => rule.id)

describe("password policy", () => {
  it("lists the three checklist rules in order", () => {
    expect(PASSWORD_RULES.map((rule) => rule.label)).toEqual(["8+ characters", "A letter", "A number"])
  })

  it("ticks rules live: 'abc1' has a letter and a number but not 8 characters", () => {
    expect(met("")).toEqual([])
    expect(met("abc1")).toEqual(["letter", "number"])
    expect(met("abcdefg1")).toEqual(["length", "letter", "number"])
  })

  it("counts length in code points, like the server's runes", () => {
    const emoji = "\u{1F600}"
    expect(emoji.length).toBe(2)
    expect(passwordLength(emoji)).toBe(1)
    // Seven emoji + "a" = 8 code points (15 UTF-16 units): long enough, but no number.
    expect(passwordProblems(emoji.repeat(7) + "a")).toEqual([PASSWORD_MESSAGES.needsNumber])
    // Four emoji = 8 UTF-16 units but only 4 code points.
    expect(met(emoji.repeat(4))).toEqual([])
  })

  it("accepts any Unicode letter and decimal digit", () => {
    expect(met("Ж")).toEqual(["letter"])
    expect(met("٣")).toEqual(["number"]) // Arabic-Indic digit three
    expect(met("²")).toEqual([]) // superscript two is not a decimal digit (\p{Nd})
  })

  it("reports every broken rule, plus the 128 maximum", () => {
    expect(passwordProblems("")).toEqual([
      PASSWORD_MESSAGES.tooShort,
      PASSWORD_MESSAGES.needsLetter,
      PASSWORD_MESSAGES.needsNumber,
    ])
    expect(passwordProblems("Passw0rd!")).toEqual([])
    expect(passwordProblems("a1".repeat(64))).toEqual([])
    expect(passwordProblems("a1".repeat(64) + "x")).toEqual([PASSWORD_MESSAGES.tooLong])
  })
})
