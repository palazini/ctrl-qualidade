// src/pages/company/QualityPage.tsx
import { useEffect, useState, useMemo } from 'react';
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
  Select,
  TextInput,
} from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import { IconUpload, IconX } from '@tabler/icons-react';
import { supabase } from '../../lib/supabaseClient';

type VersionStage =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CHANGES'
  | 'EDITED_BY_QUALITY'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED';

type VersionRow = {
  id: string;
  version_number: number;
  stage: VersionStage;
  source_file_name: string | null;
  source_file_url: string | null;
  created_at: string;
};

type DocTypeRow = {
  id: string;
  name: string;
  code: string | null;
};

type RiskLevel = 'LOW' | 'HIGH';

type DocumentRow = {
  id: string;
  title: string;
  code: string | null;
  status: string | null;
  updated_at: string;
  document_type_id: string | null;
  doc_type: DocTypeRow[] | null;
  versions: VersionRow[] | null;

  risk_level: RiskLevel | null;
  elaborator: string | null;
  approver: string | null;
};

type ReviewDoc = {
  id: string;
  title: string;
  code: string | null;
  status: string | null;
  updatedAt: string;
  docTypeId: string | null;
  docTypeLabel: string | null;

  lastVersionId: string | null;
  lastVersionNumber: number;
  lastStage: VersionStage | null;
  lastFileName: string | null;
  lastFileUrl: string | null;

  riskLevel: RiskLevel | null;
  elaborator: string | null;
  approver: string | null;
};

type DocTypeOption = { value: string; label: string };

function stageBadge(stage: VersionStage | null) {
  if (!stage) {
    return (
      <Badge size="xs" color="gray" variant="light">
        Sem status
      </Badge>
    );
  }

  const labelMap: Record<VersionStage, string> = {
    SUBMITTED: 'Enviado',
    UNDER_REVIEW: 'Em revisão',
    NEEDS_CHANGES: 'Precisa de ajustes',
    EDITED_BY_QUALITY: 'Editado pela Qualidade',
    READY_TO_PUBLISH: 'Pronto para publicar',
    PUBLISHED: 'Publicado',
  };

  const colorMap: Record<VersionStage, string> = {
    SUBMITTED: 'blue',
    UNDER_REVIEW: 'indigo',
    NEEDS_CHANGES: 'orange',
    EDITED_BY_QUALITY: 'grape',
    READY_TO_PUBLISH: 'teal',
    PUBLISHED: 'green',
  };

  return (
    <Badge size="xs" color={colorMap[stage]} variant="light">
      {labelMap[stage]}
    </Badge>
  );
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

// Helper para embutir pré-visualização
function buildPreviewUrl(fileUrl: string | null) {
  if (!fileUrl) return null;

  const lower = fileUrl.toLowerCase();

  // PDF o navegador mostra direto
  if (lower.endsWith('.pdf')) {
    return fileUrl;
  }

  // Extensões Office → Office Web Viewer
  const officeExts = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
  if (officeExts.some((ext) => lower.endsWith(ext))) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
      fileUrl
    )}`;
  }

  // fallback
  return fileUrl;
}

export default function QualityPage() {
  const { company, currentRole, appUser } =
    useOutletContext<CompanyOutletContext>();

  const [loadingDocs, setLoadingDocs] = useState(true);
  const [errorDocs, setErrorDocs] = useState<string | null>(null);
  const [docs, setDocs] = useState<ReviewDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [uploadingNewVersion, setUploadingNewVersion] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [docTypeOptions, setDocTypeOptions] = useState<DocTypeOption[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  const [elaborator, setElaborator] = useState<string>('');
  const [approver, setApprover] = useState<string>('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);

  const bucketName = 'documents-source';

  // apenas Gestor de Qualidade acessa
  if (currentRole !== 'GESTOR_QUALIDADE') {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={500}>Revisão da Qualidade</Text>
          <Text size="sm" c="dimmed">
            Esta área é restrita a Gestores de Qualidade.
          </Text>
        </Stack>
      </Card>
    );
  }

  async function loadDocTypes() {
    setLoadingTypes(true);

    const { data, error } = await supabase
      .from('document_types')
      .select('id, name, code')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error(error);
      setDocTypeOptions([]);
      setLoadingTypes(false);
      return;
    }

    const mapped: DocTypeOption[] = (data ?? []).map((t: any) => ({
      value: t.id as string,
      label: t.code ? `${t.code} - ${t.name}` : (t.name as string),
    }));

    setDocTypeOptions(mapped);
    setLoadingTypes(false);
  }

  async function loadDocuments() {
    setLoadingDocs(true);
    setErrorDocs(null);

    const { data, error } = await supabase
      .from('documents')
      .select(
        `
        id,
        title,
        code,
        status,
        updated_at,
        document_type_id,
        risk_level,
        elaborator,
        approver,
        doc_type:document_types (
          id,
          name,
          code
        ),
        versions:document_versions!document_versions_document_id_fkey (
          id,
          version_number,
          stage,
          source_file_name,
          source_file_url,
          created_at
        )
      `
      )
      .eq('company_id', company.id)
      .eq('status', 'IN_REVIEW')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error(error);
      setErrorDocs('Erro ao carregar documentos em revisão.');
      setLoadingDocs(false);
      return;
    }

    const rows = (data ?? []) as DocumentRow[];

    const mapped: ReviewDoc[] = rows.map((doc) => {
      const versions = doc.versions ?? [];
      const latest =
        versions.length === 0
          ? null
          : [...versions].sort(
              (a, b) => b.version_number - a.version_number
            )[0];

      const dt =
        doc.doc_type && doc.doc_type.length > 0
          ? doc.doc_type[0]
          : null;

      const typeLabel =
        dt && dt.code
          ? `${dt.code} - ${dt.name}`
          : dt
          ? dt.name
          : null;

      return {
        id: doc.id,
        title: doc.title,
        code: doc.code,
        status: doc.status,
        updatedAt: doc.updated_at,
        docTypeId: doc.document_type_id,
        docTypeLabel: typeLabel,

        lastVersionId: latest?.id ?? null,
        lastVersionNumber: latest?.version_number ?? 0,
        lastStage: latest?.stage ?? null,
        lastFileName: latest?.source_file_name ?? null,
        lastFileUrl: latest?.source_file_url ?? null,

        riskLevel: doc.risk_level,
        elaborator: doc.elaborator,
        approver: doc.approver,
      };
    });

    setDocs(mapped);

    if (mapped.length === 0) {
      setSelectedId(null);
    } else {
      setSelectedId((prev) => {
        if (prev && mapped.some((d) => d.id === prev)) return prev;
        return mapped[0].id;
      });
    }

    setLoadingDocs(false);
  }

  useEffect(() => {
    loadDocuments();
    loadDocTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const selectedDoc: ReviewDoc | null = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? null,
    [docs, selectedId]
  );

  // URL de preview (pdf direto, office via viewer)
  const previewUrl = buildPreviewUrl(selectedDoc?.lastFileUrl ?? null);

  // sempre que mudar o documento selecionado, pré-preenche o tipo, se existir
  useEffect(() => {
    if (!selectedDoc) {
      setSelectedTypeId(null);
      setElaborator('');
      setApprover('');
      setRiskLevel(null);
      return;
    }

    setSelectedTypeId(selectedDoc.docTypeId || null);
    setElaborator(selectedDoc.elaborator ?? '');
    setApprover(selectedDoc.approver ?? '');
    setRiskLevel(selectedDoc.riskLevel ?? null);
  }, [selectedDoc]);

  async function handleUploadNewVersion(files: File[]) {
    if (!selectedDoc) {
      alert('Selecione um documento na lista à esquerda.');
      return;
    }

    if (!files.length) return;

    const file = files[0];
    setUploadingNewVersion(true);

    try {
      const path = `${appUser.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error(uploadError);
        throw new Error('Falha ao enviar o arquivo editado para o Storage.');
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(path);

      const publicUrl = publicUrlData?.publicUrl ?? null;

      const newVersionNumber = (selectedDoc.lastVersionNumber || 0) + 1;

      const { data: versionInsertData, error: versionError } =
        await supabase
          .from('document_versions')
          .insert({
            document_id: selectedDoc.id,
            version_number: newVersionNumber,
            stage: 'EDITED_BY_QUALITY',
            source_file_name: file.name,
            source_file_url: publicUrl,
            source_mime_type: file.type || 'application/octet-stream',
            uploaded_by: appUser.id,
          })
          .select('id')
          .single();

      if (versionError || !versionInsertData) {
        console.error(versionError);
        throw new Error('Falha ao registrar nova versão do documento.');
      }

      const versionId = versionInsertData.id as string;

      const { error: updateError } = await supabase
        .from('documents')
        .update({
          current_version_id: versionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedDoc.id);

      if (updateError) {
        console.error(updateError);
        throw new Error(
          'Falha ao atualizar o documento com a nova versão.'
        );
      }

      await loadDocuments();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao enviar nova versão.');
    } finally {
      setUploadingNewVersion(false);
    }
  }

  async function handlePublish() {
    if (!selectedDoc) {
      alert('Selecione um documento na lista à esquerda.');
      return;
    }

    if (!selectedDoc.lastVersionId) {
      alert(
        'Não foi possível identificar a versão atual do documento para publicar.'
      );
      return;
    }

    if (loadingTypes) {
      alert('Tipos de documento ainda estão carregando. Aguarde um instante.');
      return;
    }

    if (docTypeOptions.length === 0) {
      alert(
        'Nenhum tipo de documento ativo cadastrado. Cadastre em "Tipos de Documento" antes de publicar.'
      );
      return;
    }

    if (!selectedTypeId) {
      alert('Selecione o tipo de documento antes de publicar.');
      return;
    }

    if (!elaborator.trim() || !approver.trim() || !riskLevel) {
      alert(
        'Informe o elaborador, o aprovador e a classificação de risco antes de publicar.'
      );
      return;
    }

    const confirmed = window.confirm(
      'Confirmar publicação deste documento? Ele ficará disponível na biblioteca para os colaboradores.'
    );
    if (!confirmed) return;

    setPublishing(true);

    try {
      const { error: vErr } = await supabase
        .from('document_versions')
        .update({ stage: 'PUBLISHED' })
        .eq('id', selectedDoc.lastVersionId);

      if (vErr) {
        console.error(vErr);
        throw new Error('Falha ao atualizar o estágio da versão.');
      }

      const nowIso = new Date().toISOString();

      const { error: dErr } = await supabase
        .from('documents')
        .update({
          status: 'PUBLISHED',
          document_type_id: selectedTypeId,
          current_version_id: selectedDoc.lastVersionId,
          updated_at: nowIso,
          published_at: nowIso,          // data da publicação
          elaborator: elaborator.trim(), // quem elaborou
          approver: approver.trim(),     // quem aprovou
          risk_level: riskLevel,         // LOW ou HIGH
        })
        .eq('id', selectedDoc.id);

      if (dErr) {
        console.error(dErr);
        throw new Error('Falha ao atualizar o status do documento.');
      }

      await loadDocuments();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao publicar documento.');
    } finally {
      setPublishing(false);
    }
  }

  const hasDocs = docs.length > 0;

  if (loadingDocs) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Center h={200}>
          <Loader size="lg" />
        </Center>
      </Card>
    );
  }

  if (errorDocs) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={500}>Revisão da Qualidade</Text>
          <Text size="sm" c="dimmed">
            {errorDocs}
          </Text>
        </Stack>
      </Card>
    );
  }

  if (!hasDocs) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={500}>Revisão da Qualidade</Text>
          <Text size="sm" c="dimmed">
            Não há documentos em revisão para esta companhia.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="sm" h="100%">
        <Group justify="space-between" align="center">
          <Text fw={500}>Documentos em revisão</Text>
          <Badge variant="light" color="blue">
            {docs.length} documento(s)
          </Badge>
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
                {docs.map((doc) => {
                  const isActive = doc.id === selectedDoc?.id;
                  const updatedLabel = formatDateTime(doc.updatedAt);

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
                          </Stack>
                          {stageBadge(doc.lastStage)}
                        </Group>

                        {doc.lastFileName && (
                          <Text size="xs" c="dimmed">
                            Último arquivo: {doc.lastFileName}
                          </Text>
                        )}

                        {updatedLabel && (
                          <Text size="xs" c="dimmed">
                            Atualizado em: {updatedLabel}
                          </Text>
                        )}
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Card>

          {/* Detalhes à direita */}
          <Card withBorder radius="md" shadow="xs">
            {selectedDoc ? (
              <Stack gap="sm">
                <Stack gap={2}>
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={0}>
                      <Text fw={500}>{selectedDoc.title}</Text>
                      {selectedDoc.code && (
                        <Text size="sm" c="dimmed">
                          Código: {selectedDoc.code}
                        </Text>
                      )}
                    </Stack>
                    {stageBadge(selectedDoc.lastStage)}
                  </Group>

                  {selectedDoc.lastFileName && (
                    <Text size="xs" c="dimmed">
                      Arquivo atual: {selectedDoc.lastFileName}
                    </Text>
                  )}

                  {selectedDoc.updatedAt && (
                    <Text size="xs" c="dimmed">
                      Atualizado em:{' '}
                      {formatDateTime(selectedDoc.updatedAt)}
                    </Text>
                  )}

                  {selectedDoc.docTypeLabel && (
                    <Text size="xs" c="dimmed">
                      Tipo atual:{' '}
                      <b>{selectedDoc.docTypeLabel}</b>
                    </Text>
                  )}
                </Stack>

                <Group justify="flex-end" gap="xs">
                  <Button
                    size="xs"
                    onClick={handlePublish}
                    loading={publishing}
                  >
                    Aprovar e publicar
                  </Button>
                </Group>

                <Select
                  label="Tipo de documento para publicação"
                  placeholder={
                    loadingTypes
                      ? 'Carregando tipos...'
                      : docTypeOptions.length === 0
                      ? 'Nenhum tipo cadastrado (veja "Tipos de Documento")'
                      : 'Selecione o tipo'
                  }
                  data={docTypeOptions}
                  value={selectedTypeId}
                  onChange={setSelectedTypeId}
                  searchable
                  nothingFoundMessage="Nenhum tipo encontrado"
                  size="xs"
                />

                <Group grow mt="sm">
                  <TextInput
                    label="Elaborador do documento"
                    placeholder="Quem elaborou o documento"
                    value={elaborator}
                    onChange={(e) => setElaborator(e.currentTarget.value)}
                    size="xs"
                  />
                  <TextInput
                    label="Aprovador do documento"
                    placeholder="Quem aprovou na Qualidade"
                    value={approver}
                    onChange={(e) => setApprover(e.currentTarget.value)}
                    size="xs"
                  />
                </Group>

                <Select
                  mt="xs"
                  label="Classificação de risco"
                  placeholder="Selecione o risco"
                  data={[
                    { value: 'LOW', label: 'Baixo' },
                    { value: 'HIGH', label: 'Alto' },
                  ]}
                  value={riskLevel}
                  onChange={(value) => setRiskLevel(value as RiskLevel | null)}
                  size="xs"
                />

                {/* Visualização online - área maior */}
                <Stack gap={4} mt="sm">
                  <Text fw={500} size="sm">
                    Visualização online
                  </Text>
                  {previewUrl ? (
                    <div
                      style={{
                        border: '1px solid #e1e4e8',
                        borderRadius: 8,
                        overflow: 'hidden',
                        height: '55vh',
                      }}
                    >
                      <iframe
                        src={previewUrl}
                        title="Visualização do arquivo"
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                        }}
                      />
                    </div>
                  ) : (
                    <Text size="xs" c="dimmed">
                      Nenhum arquivo disponível para visualização.
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    A visualização usa o leitor do navegador/Office online.
                    Use a rolagem e zoom da própria área de preview conforme
                    necessário.
                  </Text>
                </Stack>

                {/* Upload de nova versão - mais compacto, abaixo do preview */}
                <Stack gap="xs" mt="sm">
                  <Text fw={500} size="sm">
                    Enviar nova versão (edição pela Qualidade)
                  </Text>
                  <Text size="xs" c="dimmed">
                    Use quando a própria Qualidade ajustar o documento
                    (texto, layout, correções) e quiser registrar uma nova
                    versão antes da publicação.
                  </Text>

                  <Dropzone
                    onDrop={handleUploadNewVersion}
                    multiple={false}
                    loading={uploadingNewVersion}
                    accept={[
                      MIME_TYPES.doc,
                      MIME_TYPES.docx,
                      MIME_TYPES.xlsx,
                      MIME_TYPES.xls,
                      MIME_TYPES.ppt,
                      MIME_TYPES.pptx,
                    ]}
                    maxSize={20 * 1024 * 1024}
                    radius="md"
                    styles={{
                      root: {
                        border: '1px dashed #d0d7de',
                        backgroundColor: '#ffffff',
                        transition:
                          'border-color 150ms ease, box-shadow 150ms ease',
                        cursor: 'pointer',
                      },
                    }}
                  >
                    <Group
                      justify="center"
                      gap="md"
                      mih={120}
                      style={{ pointerEvents: 'none' }}
                    >
                      <Dropzone.Accept>
                        <IconUpload
                          size={32}
                          stroke={1.6}
                          color="#228be6"
                        />
                      </Dropzone.Accept>

                      <Dropzone.Reject>
                        <IconX
                          size={32}
                          stroke={1.6}
                          color="#fa5252"
                        />
                      </Dropzone.Reject>

                      <Dropzone.Idle>
                        <IconUpload
                          size={32}
                          stroke={1.6}
                          color="#868e96"
                        />
                      </Dropzone.Idle>

                      <Stack gap={2} align="center">
                        <Text fw={500} size="sm">
                          Solte o arquivo editado aqui
                        </Text>
                        <Text size="xs" c="dimmed">
                          ou clique para selecionar no seu computador
                        </Text>
                        <Text size="xs" c="dimmed">
                          Formatos: Word, Excel ou PowerPoint (até 20 MB)
                        </Text>
                      </Stack>
                    </Group>
                  </Dropzone>
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
