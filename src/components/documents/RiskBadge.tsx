// src/components/documents/RiskBadge.tsx
import { Badge } from '@mantine/core';
import type { RiskLevel } from '../../types/documents';
import { getRiskColor, getRiskLabel } from '../../utils/documents';

type Props = {
  risk: RiskLevel | null | undefined;
  size?: 'xs' | 'sm' | 'md';
};

export function RiskBadge({ risk, size = 'xs' }: Props) {
  return (
    <Badge size={size} color={getRiskColor(risk)} variant="light">
      {getRiskLabel(risk)}
    </Badge>
  );
}
