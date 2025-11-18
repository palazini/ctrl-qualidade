// src/components/documents/RiskBadge.tsx
import { Badge } from '@mantine/core';
import type { RiskLevel } from '../../types/documents';
import { getRiskColor, getRiskLabel } from '../../utils/documents';

type Props = {
  // pode vir 'LOW' | 'HIGH' | null | undefined de qualquer tela
  risk?: RiskLevel | null;
  size?: 'xs' | 'sm' | 'md';
};

export function RiskBadge({ risk, size = 'xs' }: Props) {
  return (
    <Badge size={size} color={getRiskColor(risk)} variant="light">
      {getRiskLabel(risk)}
    </Badge>
  );
}
