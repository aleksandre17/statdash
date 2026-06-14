export function HeroGraphic() {
  return (
    <svg className="hero__graphic" viewBox="0 0 800 500" aria-hidden="true">
      <path
        d="M0 480 L50 420 L100 430 L150 380 L200 390 L250 320 L300 340 L350 280 L400 260 L450 230 L500 250 L550 180 L600 160 L650 120 L700 80 L750 50 L800 30"
        fill="none" stroke="#0080BE" strokeWidth="3"
      />
      <path
        d="M0 480 L50 450 L100 440 L150 410 L200 420 L250 380 L300 370 L350 340 L400 350 L450 310 L500 290 L550 260 L600 250 L650 220 L700 190 L750 170 L800 140"
        fill="none" stroke="#00A896" strokeWidth="2"
      />
      {[100, 200, 300, 400, 500, 600, 700].map((x, i) => (
        <rect
          key={x}
          x={x - 15} y={350 - i * 30}
          width={30}  height={i * 30 + 130}
          rx={4} fill="#0080BE" opacity={0.04 + i * 0.008}
        />
      ))}
    </svg>
  )
}