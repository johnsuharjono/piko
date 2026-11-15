export function ComponentThumbnail({
  kind,
}: {
  kind: import("../circuit/palette").PaletteKind;
}) {
  return (
    <svg
      className="component-thumbnail"
      viewBox="0 0 120 84"
      aria-hidden="true"
    >
      {kind === "lcd" ? (
        <>
          <rect x="10" y="15" width="100" height="55" rx="4" fill="#26785c" />
          <rect x="19" y="23" width="82" height="35" fill="#b8d678" />
          <text x="25" y="45" fontSize="10" fill="#263d26">
            Hello Piko
          </text>
        </>
      ) : kind === "breadboard" ? (
        <>
          <rect
            x="12"
            y="10"
            width="96"
            height="64"
            rx="4"
            fill="#fff"
            stroke="#c5cbd1"
            strokeWidth="1.5"
          />
          <path d="M18 18h84m-84 46h84" stroke="#dc7174" />
          <path d="M18 22h84m-84 38h84" stroke="#779cc9" />
          <rect x="17" y="39" width="86" height="5" rx="1" fill="#e4e7e9" />
          {Array.from({ length: 12 }, (_, i) =>
            [29, 34, 49, 54].map((y) => (
              <circle
                key={`${i}-${y}`}
                cx={21 + i * 7}
                cy={y}
                r="1.4"
                fill="#a6afb6"
              />
            )),
          )}
        </>
      ) : kind === "resistor" ? (
        <g transform="translate(60 42) rotate(-30)">
          <path d="M-44 0H44" stroke="#8c979e" strokeWidth="2.5" />
          <rect
            x="-23"
            y="-9"
            width="46"
            height="18"
            rx="6"
            fill="#d8c394"
            stroke="#b4a078"
          />
          <path d="M-14-9v18m9-18v18" stroke="#db8233" strokeWidth="5" />
          <path d="M5-9v18" stroke="#69432c" strokeWidth="5" />
          <path d="M16-9v18" stroke="#a79148" strokeWidth="3" />
        </g>
      ) : kind === "button" ? (
        <>
          <rect
            x="36"
            y="20"
            width="48"
            height="44"
            rx="5"
            fill="#79858d"
            stroke="#59666f"
          />
          <circle cx="60" cy="40" r="16" fill="#303c44" />
          <path d="M28 30h8m48 22h8" stroke="#a3adb4" strokeWidth="4" />
        </>
      ) : kind === "switch" ? (
        <>
          <path d="M28 42h64" stroke="#98a4ac" strokeWidth="3" />
          <rect x="35" y="25" width="50" height="33" rx="4" fill="#52616c" />
          <rect x="42" y="30" width="36" height="21" rx="2" fill="#27353f" />
          <rect x="43" y="31" width="15" height="19" rx="1" fill="#aeb7bd" />
        </>
      ) : (
        <>
          <path d="M50 48v24m20-24v19" stroke="#9aa4a9" strokeWidth="3" />
          <path
            d="M42 48V30a18 18 0 0 1 36 0v18Z"
            fill={
              kind === "led-green"
                ? "#459867"
                : kind === "led-amber"
                  ? "#d5a33e"
                  : "#bb4040"
            }
            stroke={
              kind === "led-green"
                ? "#33744d"
                : kind === "led-amber"
                  ? "#a87c23"
                  : "#96302f"
            }
            strokeWidth="1.5"
          />
          <path
            d="M48 30v8"
            stroke="#ec9090"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect
            x="39"
            y="46"
            width="42"
            height="7"
            rx="3"
            fill={
              kind === "led-green"
                ? "#33744d"
                : kind === "led-amber"
                  ? "#b68a2f"
                  : "#ab3535"
            }
          />
        </>
      )}
    </svg>
  );
}
