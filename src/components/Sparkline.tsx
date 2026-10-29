interface Props {
  values: number[];
  tone: string;
  width?: number;
  height?: number;
}

/** Latency history as a bare polyline: no axes, no library, no layout shift. */
export function Sparkline({ values, tone, width = 96, height = 26 }: Props) {
  if (values.length < 2) {
    return <svg className="spark" width={width} height={height} aria-hidden="true" />;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1);
  const step = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - 2 - ((v - min) / span) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const lastX = width;
  const lastY = height - 2 - ((values[values.length - 1] - min) / span) * (height - 4);

  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke={tone} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
      <circle cx={lastX - 1} cy={lastY} r="1.9" fill={tone} />
    </svg>
  );
}
