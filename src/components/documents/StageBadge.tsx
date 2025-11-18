// src/components/documents/StageBadge.tsx
import { Badge } from '@mantine/core';
import type { VersionStage } from '../../types/documents';
import {
  VERSION_STAGE_COLORS,
  VERSION_STAGE_LABELS,
} from '../../types/documents';

type Props = {
  stage: VersionStage | null;
  size?: 'xs' | 'sm' | 'md';
};

export function StageBadge({ stage, size = 'xs' }: Props) {
  if (!stage) {
    return (
      <Badge size={size} color="gray" variant="light">
        Sem status
      </Badge>
    );
  }

  return (
    <Badge size={size} color={VERSION_STAGE_COLORS[stage]} variant="light">
      {VERSION_STAGE_LABELS[stage]}
    </Badge>
  );
}
