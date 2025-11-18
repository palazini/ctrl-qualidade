// src/types/documents.ts

// Status geral do documento na tabela `documents`
export type DocumentStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'PUBLISHED'
  | 'ARCHIVED';

// Estágios da versão na tabela `document_versions`
export type VersionStage =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CHANGES'
  | 'EDITED_BY_QUALITY'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED';

// 👇 aqui é a alteração principal
// "Domínio" do campo risco
export type RiskLevel = 'LOW' | 'HIGH';

// Rótulos e cores para stage (usado pelos badges)
export const VERSION_STAGE_LABELS: Record<VersionStage, string> = {
  SUBMITTED: 'Enviado',
  UNDER_REVIEW: 'Em revisão',
  NEEDS_CHANGES: 'Precisa de ajustes',
  EDITED_BY_QUALITY: 'Editado pela Qualidade',
  READY_TO_PUBLISH: 'Pronto para publicar',
  PUBLISHED: 'Publicado',
};

export const VERSION_STAGE_COLORS: Record<VersionStage, string> = {
  SUBMITTED: 'blue',
  UNDER_REVIEW: 'indigo',
  NEEDS_CHANGES: 'orange',
  EDITED_BY_QUALITY: 'grape',
  READY_TO_PUBLISH: 'teal',
  PUBLISHED: 'green',
};
