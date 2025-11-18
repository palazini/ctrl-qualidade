// src/pages/company/PublisherPage.tsx
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CompanyOutletContext } from './CompanyLayoutPage';
import {
  Card,
  Stack,
  Text,
  Group,
  Badge,
  Button,
  SimpleGrid,
  Loader,
  Center,
  ScrollArea,
} from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import { IconUpload, IconX } from '@tabler/icons-react';
import { supabase } from '../../lib/supabaseClient';

// tipos/helpers centralizados
import type { VersionStage } from '../../types/documents';
import { formatDateTime, prettyTitleFromFilename } from '../../utils/documents';

type VersionRow = {
  id: string;
  version_number: number;
  stage: VersionStage;
  source_file_name: string | null;
  source_file_url: string | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  title: string;
  code: string | null;
  updated_at: string;
  status: string;
  versions: VersionRow[] | null;
};

type MyDoc = {
  id: string;
  title: string;
  code: string | null;
  status: string | null;
  lastStage: VersionStage | null;
  lastFileName: string | null;
  lastFileUrl: string | null;
  lastUpdatedAt: string;
};

// Badge para estágio da ÚLTIMA versão
function stageBadge(stage: VersionStage | null) {
  if (!stage) {
    return (
      <Badge size="xs" color="gray" variant="light">
        Sem versão
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

// Label textual para o status do DOCUMENTO
function documentStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'DRAFT':
      return 'Rascunho';
    case 'IN_REVIEW':
      return 'Em revisão pela Qualidade';
    case 'PUBLISHED':
      return 'Publicado';
    case 'ARCHIVED':
      return 'Arquivado';
    default:
      return 'Status não informado';
  }
}

export default function PublisherPage() {
  const { company, appUser } = useOutletContext<CompanyOutletContext>();

  const [uploading, setUploading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [errorList, setErrorList] = useState<string | null>(null);
  const [docs, setDocs] = useState<MyDoc[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const companyId = company.id;
  const userId = appUser.id;

  const bucketName = 'documents-source';

  async function loadMyDocuments() {
    setLoadingList(true);
    setErrorList(null);

    const { data, error } = await supabase
      .from('documents')
      .select(
        `
        id,
        title,
        code,
        updated_at,
        status,
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
      .eq('company_id', companyId)
      .eq('created_by', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error(error);
      setErrorList('Erro ao carregar seus documentos.');
      setLoadingList(false);
      return;
    }

    const rows = (data ?? []) as DocumentRow[];

    const mapped: MyDoc[] = rows.map((doc) => {
      const versions = doc.versions ?? [];
      const latest =
        versions.length === 0
          ? null
          : [...versions].sort(
              (a, b) => b.version_number - a.version_number
            )[0];

      return {
        id: doc.id,
        title: doc.title,
        code: doc.code,
        status: doc.status ?? null,
        lastStage: latest?.stage ?? null,
        lastFileName: latest?.source_file_name ?? null,
        lastFileUrl: latest?.source_file_url ?? null,
        lastUpdatedAt: doc.updated_at,
      };
    });

    setDocs(mapped);
    setLoadingList(false);
  }

  useEffect(() => {
    loadMyDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, userId]);

  async function handleUpload(files: File[]) {
    if (!files.length) return;

    const file = files[0];
    setUploading(true);

    try {
      // 1) Upload para o Storage
      const path = `${userId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error(uploadError);
        throw new Error('Falha ao enviar o arquivo para o Storage.');
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(path);

      const publicUrl = publicUrlData?.publicUrl ?? null;

      // 2) Criar documento base
      const { data: docInsertData, error: docError } = await supabase
        .from('documents')
        .insert({
          company_id: companyId,
          title: prettyTitleFromFilename(file.name),
          code: null,
          created_by: userId,
          status: 'IN_REVIEW', // documento entra na fila da Qualidade
        })
        .select('id')
        .single();

      if (docError || !docInsertData) {
        console.error(docError);
        throw new Error('Falha ao criar registro de documento.');
      }

      const documentId = docInsertData.id as string;

      // 3) Criar primeira versão
      const { data: versionInsertData, error: versionError } =
        await supabase
          .from('document_versions')
          .insert({
            document_id: documentId,
            version_number: 1,
            stage: 'SUBMITTED', // enviada para análise
            source_file_name: file.name,
            source_file_url: publicUrl,
            source_mime_type: file.type || 'application/octet-stream',
            uploaded_by: userId,
          })
          .select('id')
          .single();

      if (versionError || !versionInsertData) {
        console.error(versionError);
        throw new Error('Falha ao criar a versão do documento.');
      }

      const versionId = versionInsertData.id as string;

      // 4) Atualizar documento com current_version_id
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          current_version_id: versionId,
        })
        .eq('id', documentId);

      if (updateError) {
        console.error(updateError);
        throw new Error(
          'Falha ao atualizar o documento com a versão atual.'
        );
      }

      await loadMyDocuments();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao enviar documento.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: MyDoc) {
    // segurança: não deixa excluir algo já publicado
    if (doc.status === 'PUBLISHED' || doc.lastStage === 'PUBLISHED') {
      alert('Não é possível excluir documentos já publicados.');
      return;
    }

    const confirmed = window.confirm(
      'Tem certeza que deseja excluir este envio e todas as versões associadas?'
    );
    if (!confirmed) return;

    setDeletingId(doc.id);

    try {
      // 1) Buscar versões para limpar os arquivos no Storage
      const { data: versions, error: vError } = await supabase
        .from('document_versions')
        .select('id, source_file_url')
        .eq('document_id', doc.id);

      if (vError) {
        console.error(vError);
        throw new Error('Falha ao buscar versões do documento.');
      }

      if (versions && versions.length > 0) {
        for (const v of versions) {
          const url = v.source_file_url as string | null;
          if (!url) continue;

          // URL típica:
          // https://.../storage/v1/object/public/documents-source/userId/arquivo.docx
          const marker = `/documents-source/`;
          const idx = url.indexOf(marker);
          if (idx === -1) continue;

          const path = url.substring(idx + marker.length);
          const { error: delErr } = await supabase.storage
            .from(bucketName)
            .remove([path]);

          if (delErr) {
            // não vamos travar tudo se der erro em 1 arquivo, só logar
            console.error('Erro ao remover arquivo do Storage:', delErr);
          }
        }
      }

      // 2) Limpar current_version_id do documento
      const { error: clearCurrentErr } = await supabase
        .from('documents')
        .update({ current_version_id: null })
        .eq('id', doc.id);

      if (clearCurrentErr) {
        console.error(clearCurrentErr);
        throw new Error(
          'Falha ao limpar a versão atual do documento antes da exclusão.'
        );
      }

      // 3) Excluir versões
      const { error: delVersionsErr } = await supabase
        .from('document_versions')
        .delete()
        .eq('document_id', doc.id);

      if (delVersionsErr) {
        console.error(delVersionsErr);
        throw new Error('Falha ao excluir versões do documento.');
      }

      // 4) Excluir documento
      const { error: delDocErr } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (delDocErr) {
        console.error(delDocErr);
        throw new Error('Falha ao excluir o documento.');
      }

      await loadMyDocuments();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao excluir envio.');
    } finally {
      setDeletingId(null);
    }
  }

  const hasDocs = docs.length > 0;

  return (
    <SimpleGrid
      cols={{ base: 1, md: 2 }}
      spacing="md"
      style={{ alignItems: 'stretch' }}
    >
      {/* Card de upload */}
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <Stack gap={2}>
            <Text fw={500}>Novo envio para revisão</Text>
            <Text size="sm" c="dimmed">
              Envie aqui o arquivo editável para que a Qualidade faça a
              revisão e, se estiver tudo conforme, publique o documento
              oficial.
            </Text>
          </Stack>

          <Dropzone
            onDrop={handleUpload}
            multiple={false}
            loading={uploading}
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
              mih={140}
              style={{ pointerEvents: 'none' }}
            >
              <Dropzone.Accept>
                <IconUpload size={40} stroke={1.6} color="#228be6" />
              </Dropzone.Accept>

              <Dropzone.Reject>
                <IconX size={40} stroke={1.6} color="#fa5252" />
              </Dropzone.Reject>

              <Dropzone.Idle>
                <IconUpload size={40} stroke={1.6} color="#868e96" />
              </Dropzone.Idle>

              <Stack gap={4} align="center">
                <Text fw={500}>Solte o arquivo aqui</Text>
                <Text size="sm" c="dimmed">
                  ou clique para selecionar no seu computador
                </Text>
                <Text size="xs" c="dimmed">
                  Formatos aceitos: Word, Excel ou PowerPoint (até 20 MB)
                </Text>
              </Stack>
            </Group>
          </Dropzone>

          <Text size="xs" c="dimmed">
            Após o envio:
            <br />
            • O documento entra na fila da Qualidade;
            <br />
            • Você poderá acompanhar o status na lista ao lado;
            <br />
            • Versões futuras serão vinculadas a este mesmo documento.
          </Text>
        </Stack>
      </Card>

      {/* Lista de documentos do publicador */}
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm" h="100%">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={500}>Meus documentos enviados</Text>
              <Text size="xs" c="dimmed">
                Acompanhe aqui o status dos documentos que você enviou
                para revisão.
              </Text>
            </Stack>
            <Badge variant="light" color="blue">
              {docs.length} documento(s)
            </Badge>
          </Group>

          {loadingList ? (
            <Center h="60vh">
              <Loader size="lg" />
            </Center>
          ) : errorList ? (
            <Center h="60vh">
              <Text size="sm" c="dimmed">
                {errorList}
              </Text>
            </Center>
          ) : !hasDocs ? (
            <Center h="60vh">
              <Text size="sm" c="dimmed">
                Você ainda não enviou nenhum documento para revisão.
              </Text>
            </Center>
          ) : (
            <ScrollArea h="60vh" type="always">
              <Stack gap="xs" pr="xs">
                {docs.map((doc) => {
                  const updatedLabel = formatDateTime(doc.lastUpdatedAt);
                  const isPublished =
                    doc.status === 'PUBLISHED' ||
                    doc.lastStage === 'PUBLISHED';

                  return (
                    <Card
                      key={doc.id}
                      withBorder
                      radius="md"
                      shadow="xs"
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
                            <Text size="xs" c="dimmed">
                              Status do documento:{' '}
                              <Text span fw={500}>
                                {documentStatusLabel(doc.status)}
                              </Text>
                            </Text>
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

                        <Group justify="flex-end" gap="xs" mt="xs">
                          {!isPublished && (
                            <Button
                              size="xs"
                              variant="outline"
                              color="red"
                              onClick={() => handleDelete(doc)}
                              loading={deletingId === doc.id}
                            >
                              Excluir envio
                            </Button>
                          )}

                          {doc.lastFileUrl && (
                            <Button
                              component="a"
                              href={doc.lastFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="light"
                              size="xs"
                            >
                              Baixar arquivo
                            </Button>
                          )}
                        </Group>
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Card>
    </SimpleGrid>
  );
}
