// Fixture for tests/no-raw-colors.test.ts: every line below must be reported. Never import this file.
export function BadComponent() {
  return (
    <div className="bg-white text-black font-extrabold" style={{ color: "#1F2933", borderColor: "#FFF" }}>
      <span style={{ background: "rgb(0, 0, 0)" }}>raw</span>
      <span className="text-[#000]">raw</span>
      <span style={{ color: "white" }}>named</span>
      <span style={{ fontWeight: 800 }}>too heavy</span>
    </div>
  )
}

export const badCss = `
  .x { color: white; }
`
