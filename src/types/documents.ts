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

export type DocumentActionType =
  | 'PUBLISHED'
  | 'SENT_BACK_TO_REVIEW'
  | 'ARCHIVED'
  | 'UNARCHIVED'
  | 'DELETED';

// Shape genérico de um registro da tabela document_actions
export type DocumentActionLog = {
  id: string;
  action: DocumentActionType;
  comment: string | null;
  performed_by_name: string | null;
  performed_by_email: string | null;
  created_at: string;

  // esses campos podem existir no select, mas são opcionais
  performed_by?: string | null;
  document_id?: string | null;
};

// Label e cor padrão para cada ação
export const DOCUMENT_ACTION_LABELS: Record<DocumentActionType, string> = {
  PUBLISHED: 'Publicado',
  SENT_BACK_TO_REVIEW: 'Enviado para revisão',
  ARCHIVED: 'Arquivado',
  UNARCHIVED: 'Desarquivado',
  DELETED: 'Excluído',
};

export const DOCUMENT_ACTION_COLORS: Record<DocumentActionType, string> = {
  PUBLISHED: 'green',
  SENT_BACK_TO_REVIEW: 'blue',
  ARCHIVED: 'gray',
  UNARCHIVED: 'teal',
  DELETED: 'red',
};