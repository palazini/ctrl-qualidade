// src/pages/company/QualityPublishedPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CompanyOutletContext } from './CompanyLayoutPage';
import {
  Card,
  Stack,
  Text,
  Group,
  Badge,
  Button,
  Loader,
  Center,
  ScrollArea,
  SimpleGrid,
  TextInput,
  Select,
  Modal,
  Textarea,
} from '@mantine/core';
import { IconSearch, IconRefresh } from '@tabler/icons-react';
import { supabase } from '../../lib/supabaseClient';

// novos imports centralizados
import type { RiskLevel } from '../../types/documents';
import { buildPreviewUrl, formatDateTime } from '../../utils/documents';
import { RiskBadge } from '../../components/documents/RiskBadge';

type VersionRow = {
  id: string;
  version_number: number;
  pdf_file_url: string | null;
  pdf_file_name: string | null;
  source_file_url: string | null;
  source_file_name: string | null;
};

type DocTypeRow = {
  id: string;
  name: string;
  code: string | null;
};

type DocumentRow = {
  id: string;
  title: string;
  code: string | null;
  status: string | null;
  published_at: string | null;
  risk_level: RiskLevel | null;
  elaborator: string | null;
  approver: string | null;
  doc_type: DocTypeRow[] | null;
  current_version: VersionRow[] | null;
  versions: VersionRow[] | null;
};

type PublishedDoc = {
  id: string;
  title: string;
  code: string | null;
  status: string | null;
  publishedAt: string | null;
  riskLevel: RiskLevel | null;
  elaborator: string | null;
  approver: string | null;
  docTypeLabel: string | null;

  versionId: string | null;
  versionNumber: number;
  fileUrl: string | null;
  fileName: string | null;
};

type RiskFilter = 'ALL' | RiskLevel;

// tipos das ações registradas em histórico
type DocumentActionType =
  | 'PUBLISHED'
  | 'SENT_BACK_TO_REVIEW'
  | 'ARCHIVED'
  | 'UNARCHIVED'
  | 'DELETED';

type DocumentActionLog = {
  id: string;
  action: DocumentActionType;
  comment: string | null;
  performed_by_name: string | null;
  performed_by_email: string | null;
  created_at: string;
};

type PendingActionMode = 'ARCHIVE' | 'SEND_BACK' | null;

function actionLabel(action: DocumentActionType): string {
  switch (action) {
    case 'PUBLISHED':
      return 'Publicado';
    case 'SENT_BACK_TO_REVIEW':
      return 'Enviado para revisão';
    case 'ARCHIVED':
      return 'Arquivado';
    case 'UNARCHIVED':
      return 'Desarquivado';
    case 'DELETED':
      return 'Excluído';
    default:
      return action;
  }
}

function actionColor(action: DocumentActionType): string {
  switch (action) {
    case 'PUBLISHED':
      return 'green';
    case 'SENT_BACK_TO_REVIEW':
      return 'blue';
    case 'ARCHIVED':
      return 'gray';
    case 'UNARCHIVED':
      return 'teal';
    case 'DELETED':
      return 'red';
    default:
      return 'gray';
  }
}

export default function QualityPublishedPage() {
  const { company, currentRole, appUser, userEmail } =
    useOutletContext<CompanyOutletContext>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<PublishedDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');

  const [archiving, setArchiving] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);

  // histórico de ações
  const [actions, setActions] = useState<DocumentActionLog[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);

  // modal de comentário obrigatório
  const [pendingActionMode, setPendingActionMode] =
    useState<PendingActionMode>(null);
  const [actionComment, setActionComment] = useState('');

  // só Gestor de Qualidade
  if (currentRole !== 'GESTOR_QUALIDADE') {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={500}>Documentos publicados</Text>
          <Text size="sm" c="dimmed">
            Esta área é restrita a Gestores de Qualidade.
          </Text>
        </Stack>
      </Card>
    );
  }

  async function loadDocuments() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('documents')
      .select(
        `
        id,
        title,
        code,
        status,
        published_at,
        risk_level,
        elaborator,
        approver,
        doc_type:document_types (
          id,
          name,
          code
        ),
        current_version:document_versions!documents_current_version_fk (
          id,
          version_number,
          pdf_file_url,
          pdf_file_name,
          source_file_url,
          source_file_name
        ),
        versions:document_versions!document_versions_document_id_fkey (
          id,
          version_number,
          pdf_file_url,
          pdf_file_name,
          source_file_url,
          source_file_name
        )
      `
      )
      .eq('company_id', company.id)
      .eq('status', 'PUBLISHED')
      .order('published_at', { ascending: false });

    if (error) {
      console.error(error);
      setError('Erro ao carregar documentos publicados.');
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as DocumentRow[];

    const mapped: PublishedDoc[] = rows.map((doc) => {
      const currentArray = Array.isArray(doc.current_version)
        ? doc.current_version
        : [];
      const versionsArray = Array.isArray(doc.versions)
        ? doc.versions
        : [];

      // tenta current_version; se não tiver, cai pra última versão pelo número
      let cv: VersionRow | null =
        currentArray.length > 0 ? currentArray[0] : null;

      if (!cv && versionsArray.length > 0) {
        cv = [...versionsArray].sort(
          (a, b) => (b.version_number ?? 0) - (a.version_number ?? 0)
        )[0];
      }

      const dt =
        doc.doc_type && doc.doc_type.length > 0 ? doc.doc_type[0] : null;

      const docTypeLabel =
        dt && dt.code
          ? `${dt.code} - ${dt.name}`
          : dt
          ? dt.name
          : null;

      const fileUrl = cv
        ? cv.pdf_file_url || cv.source_file_url || null
        : null;
      const fileName = cv
        ? cv.pdf_file_name || cv.source_file_name || null
        : null;

      return {
        id: doc.id,
        title: doc.title,
        code: doc.code,
        status: doc.status,
        publishedAt: doc.published_at,
        riskLevel: doc.risk_level,
        elaborator: doc.elaborator,
        approver: doc.approver,
        docTypeLabel,

        versionId: cv?.id ?? null,
        versionNumber: cv?.version_number ?? 0,
        fileUrl,
        fileName,
      };
    });

    setDocs(mapped);

    if (mapped.length === 0) {
      setSelectedId(null);
    } else {
      setSelectedId((prev) =>
        prev && mapped.some((d) => d.id === prev) ? prev : mapped[0].id
      );
    }

    setLoading(false);
  }

  async function loadActions(documentId: string) {
    setLoadingActions(true);
    try {
      const { data, error } = await supabase
        .from('document_actions')
        .select(
          'id, action, comment, performed_by_name, performed_by_email, created_at'
        )
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setActions([]);
        return;
      }

      setActions((data ?? []) as DocumentActionLog[]);
    } finally {
      setLoadingActions(false);
    }
  }

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const filteredDocs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return docs.filter((d) => {
      if (riskFilter === 'HIGH' && d.riskLevel !== 'HIGH') return false;
      if (riskFilter === 'LOW' && d.riskLevel !== 'LOW') return false;

      if (!term) return true;

      const haystack = `${d.title} ${d.code ?? ''} ${
        d.elaborator ?? ''
      } ${d.approver ?? ''}`.toLowerCase();

      return haystack.includes(term);
    });
  }, [docs, search, riskFilter]);

  const selectedDoc: PublishedDoc | null = useMemo(
    () => filteredDocs.find((d) => d.id === selectedId) ?? null,
    [filteredDocs, selectedId]
  );

  const previewUrl = buildPreviewUrl(selectedDoc?.fileUrl ?? null);

  // sempre que mudar o documento selecionado, recarrega o histórico
  useEffect(() => {
    if (!selectedDoc) {
      setActions([]);
      return;
    }
    loadActions(selectedDoc.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoc?.id]);

  function openActionModal(mode: PendingActionMode) {
    if (!selectedDoc) return;
    setPendingActionMode(mode);
    setActionComment('');
  }

  function closeActionModal() {
    setPendingActionMode(null);
    setActionComment('');
  }

  async function handleArchive(comment: string) {
    if (!selectedDoc) return;

    setArchiving(true);
    try {
      const nowIso = new Date().toISOString();

      const { error: docErr } = await supabase
        .from('documents')
        .update({
          status: 'ARCHIVED',
          updated_at: nowIso,
        })
        .eq('id', selectedDoc.id);

      if (docErr) {
        console.error(docErr);
        throw new Error('Falha ao arquivar documento.');
      }

      // registra ação
      const { error: logErr } = await supabase
        .from('document_actions')
        .insert({
          document_id: selectedDoc.id,
          performed_by: appUser.id,
          performed_by_name: appUser.full_name,
          performed_by_email: userEmail,
          action: 'ARCHIVED',
          comment,
        });

      if (logErr) {
        console.error('Falha ao registrar ação de arquivamento:', logErr);
        // não trava o fluxo – só loga
      }

      await loadDocuments();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao arquivar documento.');
    } finally {
      setArchiving(false);
    }
  }

  async function handleSendBackToReview(comment: string) {
    if (!selectedDoc) return;

    setSendingBack(true);
    try {
      const nowIso = new Date().toISOString();

      // 1) documento volta a ficar "IN_REVIEW"
      const { error: dErr } = await supabase
        .from('documents')
        .update({
          status: 'IN_REVIEW',
          updated_at: nowIso,
        })
        .eq('id', selectedDoc.id);

      if (dErr) {
        console.error(dErr);
        throw new Error('Falha ao atualizar status do documento.');
      }

      // 2) estágio da versão atual volta para UNDER_REVIEW
      if (selectedDoc.versionId) {
        const { error: vErr } = await supabase
          .from('document_versions')
          .update({ stage: 'UNDER_REVIEW' })
          .eq('id', selectedDoc.versionId);

        if (vErr) {
          console.error(vErr);
          throw new Error('Falha ao atualizar estágio da versão.');
        }
      }

      // 3) registra ação
      const { error: logErr } = await supabase
        .from('document_actions')
        .insert({
          document_id: selectedDoc.id,
          performed_by: appUser.id,
          performed_by_name: appUser.full_name,
          performed_by_email: userEmail,
          action: 'SENT_BACK_TO_REVIEW',
          comment,
        });

      if (logErr) {
        console.error('Falha ao registrar ação de envio para revisão:', logErr);
      }

      await loadDocuments();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao reenviar documento para revisão.');
    } finally {
      setSendingBack(false);
    }
  }

  async function handleConfirmAction() {
    if (!pendingActionMode || !selectedDoc) return;

    const trimmed = actionComment.trim();
    if (!trimmed) {
      alert('Informe um comentário para registrar a ação.');
      return;
    }

    if (pendingActionMode === 'ARCHIVE') {
      await handleArchive(trimmed);
    } else if (pendingActionMode === 'SEND_BACK') {
      await handleSendBackToReview(trimmed);
    }

    closeActionModal();
  }

  if (loading) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Center h={220}>
          <Loader size="lg" />
        </Center>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={500}>Documentos publicados (Qualidade)</Text>
          <Text size="sm" c="dimmed">
            {error}
          </Text>
        </Stack>
      </Card>
    );
  }

  if (docs.length === 0) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={500}>Documentos publicados (Qualidade)</Text>
          <Text size="sm" c="dimmed">
            Ainda não há documentos publicados para esta companhia.
          </Text>
        </Stack>
      </Card>
    );
  }

  const isArchiveMode = pendingActionMode === 'ARCHIVE';
  const isSendBackMode = pendingActionMode === 'SEND_BACK';

  return (
    <Card withBorder shadow="sm" radius="md">
      {/* Modal de comentário obrigatório para ações críticas */}
      <Modal
        opened={!!pendingActionMode}
        onClose={closeActionModal}
        title={
          isArchiveMode
            ? 'Retirar documento da biblioteca'
            : isSendBackMode
            ? 'Enviar documento para revisão'
            : ''
        }
        centered
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm">
            {isArchiveMode &&
              'Este documento deixará de aparecer na biblioteca para os colaboradores, mas ficará arquivado na área de Arquivados.'}
            {isSendBackMode &&
              'Este documento será retirado da biblioteca e voltará para a fila de revisão da Qualidade.'}
          </Text>

          <Text size="xs" fw={500}>
            Documento:
          </Text>
          <Text size="sm">
            {selectedDoc?.title}{' '}
            {selectedDoc?.code && (
              <Text span size="sm" c="dimmed">
                ({selectedDoc.code})
              </Text>
            )}
          </Text>

          <Textarea
            label="Comentário (obrigatório)"
            placeholder={
              isArchiveMode
                ? 'Ex.: Documento substituído por nova norma, processo descontinuado, etc.'
                : 'Ex.: Necessário ajuste em tal seção, incluir referência, corrigir diagrama, etc.'
            }
            minRows={3}
            value={actionComment}
            onChange={(e) => setActionComment(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="default" size="xs" onClick={closeActionModal}>
              Cancelar
            </Button>
            <Button
              size="xs"
              onClick={handleConfirmAction}
              loading={isArchiveMode ? archiving : sendingBack}
              disabled={!actionComment.trim()}
              color={isArchiveMode ? 'red' : 'blue'}
            >
              Confirmar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Stack gap="sm" h="100%">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text fw={500}>Documentos publicados (Qualidade)</Text>
            <Text size="xs" c="dimmed">
              Visão interna da Qualidade com informações de risco, elaborador,
              aprovador e data de publicação.
            </Text>
          </Stack>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconRefresh size={14} />}
              onClick={loadDocuments}
            >
              Atualizar
            </Button>
            <Badge variant="light" color="blue">
              {docs.length} documento(s)
            </Badge>
          </Group>
        </Group>

        <Group align="flex-end" gap="sm">
          <TextInput
            label="Buscar"
            placeholder="Título, código, elaborador, aprovador..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            leftSection={<IconSearch size={14} />}
            size="xs"
            style={{ minWidth: 260 }}
          />
          <Select
            label="Risco"
            size="xs"
            data={[
              { value: 'ALL', label: 'Todos' },
              { value: 'LOW', label: 'Baixo' },
              { value: 'HIGH', label: 'Alto' },
            ]}
            value={riskFilter}
            onChange={(value) =>
              setRiskFilter((value as RiskFilter) || 'ALL')
            }
            style={{ width: 160 }}
          />
        </Group>

        <SimpleGrid
          cols={{ base: 1, md: 2 }}
          spacing="md"
          style={{ alignItems: 'stretch' }}
        >
          {/* Lista à esquerda */}
          <Card withBorder radius="md" shadow="xs">
            <ScrollArea h="60vh" type="always">
              <Stack gap="xs" pr="xs">
                {filteredDocs.length === 0 ? (
                  <Center h={200}>
                    <Text size="sm" c="dimmed">
                      Nenhum documento encontrado com os filtros atuais.
                    </Text>
                  </Center>
                ) : (
                  filteredDocs.map((doc) => {
                    const isActive = doc.id === selectedDoc?.id;
                    return (
                      <Card
                        key={doc.id}
                        withBorder
                        radius="md"
                        shadow={isActive ? 'sm' : 'xs'}
                        onClick={() => setSelectedId(doc.id)}
                        style={{
                          cursor: 'pointer',
                          borderColor: isActive ? '#228be6' : undefined,
                          backgroundColor: isActive ? '#f5f9ff' : undefined,
                        }}
                      >
                        <Stack gap={4}>
                          <Group justify="space-between" align="flex-start">
                            <Stack gap={0}>
                              <Text fw={500} size="sm">
                                {doc.title}
                              </Text>
                              {doc.code && (
                                <Text size="xs" c="dimmed">
                                  Código: {doc.code}
                                </Text>
                              )}
                              {doc.docTypeLabel && (
                                <Text size="xs" c="dimmed">
                                  Tipo: {doc.docTypeLabel}
                                </Text>
                              )}
                              {doc.versionNumber > 0 && (
                                <Text size="xs" c="dimmed">
                                  Versão atual: Rev. {doc.versionNumber}
                                </Text>
                              )}
                            </Stack>
                            <RiskBadge risk={doc.riskLevel} />
                          </Group>

                          <Text size="xs" c="dimmed">
                            Elaborador: {doc.elaborator || '—'} · Aprovador:{' '}
                            {doc.approver || '—'}
                          </Text>

                          {doc.publishedAt && (
                            <Text size="xs" c="dimmed">
                              Publicado em:{' '}
                              {formatDateTime(doc.publishedAt)}
                            </Text>
                          )}
                        </Stack>
                      </Card>
                    );
                  })
                )}
              </Stack>
            </ScrollArea>
          </Card>

          {/* Detalhes + preview à direita */}
          <Card withBorder radius="md" shadow="xs">
            {selectedDoc ? (
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={500}>{selectedDoc.title}</Text>
                    {selectedDoc.code && (
                      <Text size="sm" c="dimmed">
                        Código: {selectedDoc.code}
                      </Text>
                    )}
                    {selectedDoc.docTypeLabel && (
                      <Text size="xs" c="dimmed">
                        Tipo: <b>{selectedDoc.docTypeLabel}</b>
                      </Text>
                    )}
                    {selectedDoc.versionNumber > 0 && (
                      <Text size="xs" c="dimmed">
                        Versão atual: Rev. {selectedDoc.versionNumber}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed">
                      Elaborador: {selectedDoc.elaborator || '—'} · Aprovador:{' '}
                      {selectedDoc.approver || '—'}
                    </Text>
                    {selectedDoc.publishedAt && (
                      <Text size="xs" c="dimmed">
                        Publicado em:{' '}
                        {formatDateTime(selectedDoc.publishedAt)}
                      </Text>
                    )}
                  </Stack>
                  <Stack gap={4} align="flex-end">
                    <RiskBadge risk={selectedDoc.riskLevel} />
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="outline"
                        color="red"
                        onClick={() => openActionModal('ARCHIVE')}
                        loading={archiving}
                      >
                        Retirar da biblioteca
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => openActionModal('SEND_BACK')}
                        loading={sendingBack}
                      >
                        Enviar para revisão
                      </Button>
                    </Group>
                  </Stack>
                </Group>

                <Stack gap={4} mt="sm">
                  <Text fw={500} size="sm">
                    Visualização do documento
                  </Text>

                  {previewUrl ? (
                    <div
                      style={{
                        border: '1px solid #e1e4e8',
                        borderRadius: 8,
                        overflow: 'hidden',
                        height: '45vh',
                      }}
                    >
                      <iframe
                        src={previewUrl}
                        title="Visualização do documento publicado"
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                        }}
                      />
                    </div>
                  ) : (
                    <Center
                      style={{
                        border: '1px solid #e1e4e8',
                        borderRadius: 8,
                        height: '45vh',
                      }}
                    >
                      <Text size="sm" c="dimmed">
                        Nenhum arquivo disponível para visualização.
                      </Text>
                    </Center>
                  )}

                  <Text size="xs" c="dimmed">
                    A visualização utiliza o leitor do navegador ou o Office
                    Online. Use rolagem e zoom da própria área de preview.
                  </Text>
                </Stack>

                {/* Histórico de ações */}
                <Stack gap={4} mt="sm">
                  <Text fw={500} size="sm">
                    Histórico de ações da Qualidade
                  </Text>

                  {loadingActions ? (
                    <Text size="xs" c="dimmed">
                      Carregando histórico...
                    </Text>
                  ) : actions.length === 0 ? (
                    <Text size="xs" c="dimmed">
                      Nenhuma ação registrada ainda para este documento.
                    </Text>
                  ) : (
                    <ScrollArea h={140} type="always">
                      <Stack gap={6} pr="xs">
                        {actions.map((a) => (
                          <Group
                            key={a.id}
                            align="flex-start"
                            gap="xs"
                            wrap="nowrap"
                          >
                            <Badge
                              size="xs"
                              variant="light"
                              color={actionColor(a.action)}
                            >
                              {actionLabel(a.action)}
                            </Badge>
                            <Stack gap={0} style={{ flex: 1 }}>
                              <Text size="xs">
                                {formatDateTime(a.created_at)} —{' '}
                                {a.performed_by_name || 'Usuário'}{' '}
                                {a.performed_by_email && (
                                  <Text span size="xs" c="dimmed">
                                    ({a.performed_by_email})
                                  </Text>
                                )}
                              </Text>
                              {a.comment && (
                                <Text size="xs" c="dimmed">
                                  {a.comment}
                                </Text>
                              )}
                            </Stack>
                          </Group>
                        ))}
                      </Stack>
                    </ScrollArea>
                  )}
                </Stack>
              </Stack>
            ) : (
              <Center h="100%">
                <Text size="sm" c="dimmed">
                  Selecione um documento na lista ao lado.
                </Text>
              </Center>
            )}
          </Card>
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
