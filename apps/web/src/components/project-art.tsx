export function ProjectArt({
  kind,
  large = false,
}: {
  kind: string;
  large?: boolean;
}) {
  return (
    <svg
      className={`project-art ${large ? "large" : ""}`}
      viewBox="0 0 360 190"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={`dots-${kind}`}
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r=".7" fill="#cdd7d2" />
        </pattern>
      </defs>
      <rect width="360" height="190" fill={`url(#dots-${kind})`} />
      <rect x="28" y="56" width="106" height="85" rx="8" fill="#2b7489" />
      <rect x="20" y="81" width="18" height="25" rx="3" fill="#c2cdd0" />
      <text x="65" y="105" fill="#d9efeb" fontSize="17" fontFamily="monospace">
        UNO
      </text>
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <rect x={40 + i * 11} y="62" width="5" height="6" fill="#e3bd77" />
          <rect x={40 + i * 11} y="128" width="5" height="6" fill="#e3bd77" />
        </g>
      ))}
      {kind === "lcd" || kind === "counter" ? (
        <>
          <rect x="195" y="44" width="138" height="81" rx="5" fill="#2c795c" />
          <rect x="205" y="54" width="118" height="46" rx="2" fill="#c6db8e" />
          <text
            x="214"
            y="75"
            fontFamily="monospace"
            fontSize="12"
            fill="#38543b"
          >
            {kind === "counter" ? "Button counter" : "Hello, Piko!"}
          </text>
          <text
            x="214"
            y="91"
            fontFamily="monospace"
            fontSize="10"
            fill="#38543b"
          >
            {kind === "counter" ? "Count: 2" : "Seconds: 12"}
          </text>
          <path
            d="M117 65V28H167V143H214V125M106 65V37H157V153H229V125"
            stroke="#6b9997"
            strokeWidth="3"
            fill="none"
          />
        </>
      ) : (
        <>
          <rect
            x="182"
            y="57"
            width="149"
            height="97"
            rx="5"
            fill="#fffdf7"
            stroke="#c6cebf"
          />
          <path d="M193 68h126m-126 74h126" stroke="#c87258" />
          {Array.from({ length: 11 }, (_, i) =>
            [85, 96, 117, 128].map((y) => (
              <circle
                key={`${i}-${y}`}
                cx={195 + i * 11}
                cy={y}
                r="2"
                fill="#b0bbb1"
              />
            )),
          )}
          <path
            d="M43 65V33H220V86M84 134V169H195V128"
            stroke="#b67d4d"
            strokeWidth="3"
            fill="none"
          />
          <rect
            x="216"
            y="88"
            width="30"
            height="10"
            rx="3"
            fill="#d1b986"
            stroke="#a28a5c"
          />
          <path
            d="M223 88v10m6-10v10m8-10v10"
            stroke="#9a603e"
            strokeWidth="3"
          />
          <path d="M257 122v-11m10 11v-11" stroke="#83958b" strokeWidth="2" />
          <path d="M252 110v-11a10 10 0 0 1 20 0v11z" fill="#c85d4f" />
          {kind === "button" && (
            <g>
              <rect
                x="288"
                y="102"
                width="25"
                height="25"
                rx="3"
                fill="#b1bec1"
              />
              <circle cx="300" cy="114" r="8" fill="#3c5158" />
            </g>
          )}
        </>
      )}
    </svg>
  );
}
