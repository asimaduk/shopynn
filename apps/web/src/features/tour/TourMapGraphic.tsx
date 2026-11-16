'use client';

import { alpha, useTheme } from '@mui/material/styles';

type Props = {
	className?: string;
	/** Shorter banner for denser dialogs. */
	compact?: boolean;
	pinLabel?: string;
};

export default function TourMapGraphic({ className, compact = false, pinLabel = 'You are here' }: Props) {
	const theme = useTheme();
	const ink = theme.palette.mode === 'dark' ? '#E2E8F0' : '#0F172A';
	const soft = theme.palette.mode === 'dark' ? '#94A3B8' : '#64748B';
	const brand = theme.palette.primary.main || '#0A74DA';
	const wash = alpha(brand, theme.palette.mode === 'dark' ? 0.22 : 0.12);
	const card = theme.palette.mode === 'dark' ? alpha('#0F172A', 0.55) : '#FFFFFF';
	const height = compact ? 128 : 168;

	return (
		<div
			className={className}
			style={{
				background: `linear-gradient(145deg, ${wash} 0%, ${alpha(brand, 0.04)} 55%, transparent 100%)`,
				border: `1px solid ${alpha(brand, 0.16)}`,
				borderRadius: 12,
				overflow: 'hidden'
			}}
			aria-hidden
		>
			<svg viewBox={`0 0 360 ${height}`} width="100%" height={height} role="img">
				<title>Guided tour</title>
				<path
					d={
						compact
							? 'M40 78 C 80 78, 100 42, 120 42 S 170 78, 200 78 S 250 42, 280 42 S 320 78, 340 78'
							: 'M40 118 C 80 118, 100 72, 120 72 S 170 118, 200 118 S 250 72, 280 72 S 320 118, 340 118'
					}
					fill="none"
					stroke={alpha(brand, 0.45)}
					strokeWidth="3"
					strokeLinecap="round"
					strokeDasharray="6 8"
				/>
				{(compact
					? [
							{ x: 40, y: 78, label: 'Sales' },
							{ x: 120, y: 42, label: 'Stock' },
							{ x: 200, y: 78, label: 'People' },
							{ x: 280, y: 42, label: 'Buy' },
							{ x: 340, y: 78, label: 'More' }
						]
					: [
							{ x: 40, y: 118, label: 'Sales' },
							{ x: 120, y: 72, label: 'Stock' },
							{ x: 200, y: 118, label: 'People' },
							{ x: 280, y: 72, label: 'Buy' },
							{ x: 340, y: 118, label: 'More' }
						]
				).map((stop, i) => (
					<g key={stop.label} transform={`translate(${stop.x} ${stop.y})`}>
						<circle r="16" fill={card} stroke={brand} strokeWidth="2.5" />
						<circle r="5" fill={i === 0 ? brand : soft} />
						<text
							y="34"
							textAnchor="middle"
							fill={soft}
							fontSize="11"
							fontFamily="system-ui, sans-serif"
							fontWeight="600"
						>
							{stop.label}
						</text>
					</g>
				))}
				<g transform={`translate(200 ${compact ? 18 : 28})`}>
					<rect x="-54" y="-18" width="108" height="36" rx="18" fill={brand} />
					<text
						y="5"
						textAnchor="middle"
						fill="#FFFFFF"
						fontSize="13"
						fontFamily="system-ui, sans-serif"
						fontWeight="700"
					>
						{pinLabel}
					</text>
					<path d="M0 18 L8 28 L-8 28 Z" fill={brand} />
				</g>
				<g transform={`translate(310 ${compact ? 58 : 98})`}>
					<path d="M0 0 L14 10 L8 12 L12 22 L6 24 L2 14 L-4 18 Z" fill={ink} opacity="0.85" />
				</g>
			</svg>
		</div>
	);
}
